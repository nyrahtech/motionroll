import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api-utils";
import { apiRateLimiter } from "@/lib/rate-limiter";
import { createProjectFromPreset, getRecentProjects } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

const createProjectRequestSchema = z.object({
  presetId: z.enum([
    "scroll-sequence",
    "product-reveal",
    "feature-walkthrough",
    "before-after",
    "device-spin",
    "chaptered-scroll-story",
  ]),
  title: z.string().min(1).max(128).optional(),
});

function isRetryableBackendFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "ECONNREFUSED",
    "connect ECONNREFUSED",
    "Failed query:",
    "timeout expired",
  ].some((marker) => error.message.includes(marker));
}

export async function GET() {
  const { userId } = await requireAuth();
  let projects;
  try {
    projects = await getRecentProjects(userId);
  } catch (error) {
    if (isRetryableBackendFailure(error)) {
      return NextResponse.json(
        {
          error: "Workspace data is temporarily unavailable.",
          code: "workspace_unavailable",
          retryable: true,
        },
        { status: 503 },
      );
    }
    throw error;
  }
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const { userId } = await requireAuth();
  const rl = apiRateLimiter.check(userId);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }
  const bodyResult = await parseBody(request, createProjectRequestSchema);
  if (bodyResult.error) return bodyResult.error;
  let project;
  try {
    project = await createProjectFromPreset(userId, bodyResult.data.presetId, bodyResult.data.title);
  } catch (error) {
    if (isRetryableBackendFailure(error)) {
      return NextResponse.json(
        {
          error: "Workspace data is temporarily unavailable.",
          code: "workspace_unavailable",
          retryable: true,
        },
        { status: 503 },
      );
    }
    throw error;
  }
  return NextResponse.json(project, { status: 201 });
}
