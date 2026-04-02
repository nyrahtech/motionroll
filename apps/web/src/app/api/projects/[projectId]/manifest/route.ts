import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/data/projects";
import { buildProjectManifest } from "@/lib/manifest";
import { UnsupportedLegacyProjectDraftError } from "../../../../../lib/project-draft";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const project = await getProjectById(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const manifest = await buildProjectManifest(projectId, { userId });
    return NextResponse.json(manifest);
  } catch (error) {
    if (error instanceof UnsupportedLegacyProjectDraftError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
