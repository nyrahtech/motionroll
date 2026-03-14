import { NextResponse } from "next/server";
import { buildProjectManifest } from "@/lib/manifest";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const manifest = await buildProjectManifest(projectId);
  return NextResponse.json(manifest);
}
