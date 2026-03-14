import { NextResponse } from "next/server";
import { getPublishReadiness } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const readiness = await getPublishReadiness(projectId);
  return NextResponse.json(readiness);
}
