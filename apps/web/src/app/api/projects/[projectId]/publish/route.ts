import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPublishReadiness } from "@/lib/data/projects";
import { createPublishedSnapshot } from "@/lib/publish/publish-version";
import { publishRateLimiter, getClientIdentifier } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();

  // Rate limit: 5 publishes per minute per user+project
  const rl = publishRateLimiter.check(`${userId}:${(await params).projectId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many publish requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const { projectId } = await params;
  const readiness = await getPublishReadiness(projectId, userId);

  if (readiness.checks.some((check) => check.id === "project-missing")) {
    return NextResponse.json({ ok: false, readiness }, { status: 404 });
  }

  if (!readiness.ready) {
    return NextResponse.json({ ok: false, readiness }, { status: 400 });
  }

  const { manifest } = await createPublishedSnapshot(projectId, userId);

  return NextResponse.json({ ok: true, manifest, readiness });
}
