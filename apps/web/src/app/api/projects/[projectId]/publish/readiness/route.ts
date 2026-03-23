import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPublishReadiness } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const readiness = await getPublishReadiness(projectId, userId);
  if (readiness.checks.some((check) => check.id === "project-missing")) {
    return NextResponse.json(readiness, { status: 404 });
  }
  return NextResponse.json(readiness);
}
