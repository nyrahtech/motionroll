import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { duplicateProject } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const project = await duplicateProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project, { status: 201 });
}
