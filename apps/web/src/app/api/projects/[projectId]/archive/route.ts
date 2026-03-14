import { NextResponse } from "next/server";
import { archiveProject } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  await archiveProject(projectId);
  return NextResponse.json({ ok: true });
}
