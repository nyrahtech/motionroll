import { NextResponse } from "next/server";
import { duplicateProject } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const project = await duplicateProject(projectId);
  return NextResponse.json(project, { status: 201 });
}
