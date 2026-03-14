import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { LOCAL_OWNER } from "@/lib/data/local-owner";
import { getPublishReadiness } from "@/lib/data/projects";
import { createPublishedSnapshot } from "@/lib/publish/publish-version";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const readiness = await getPublishReadiness(projectId);

  if (!readiness.ready) {
    return NextResponse.json(
      {
        ok: false,
        readiness,
      },
      { status: 400 },
    );
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
    with: {
      publishTargets: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { manifest } = await createPublishedSnapshot(projectId);

  const updatedProject = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
  });

  return NextResponse.json({
    ok: true,
    manifest,
    readiness,
    project: updatedProject,
  });
}
