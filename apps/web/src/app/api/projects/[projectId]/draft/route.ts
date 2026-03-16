import { NextResponse } from "next/server";
import { ProjectDraftDocumentSchema } from "@motionroll/shared";
import { z } from "zod";
import {
  getRemoteProjectDraftSnapshot,
  saveRemoteProjectDraft,
} from "@/lib/data/project-drafts";

export const dynamic = "force-dynamic";

const patchDraftSchema = z.object({
  draft: ProjectDraftDocumentSchema,
  baseRevision: z.number().int().nonnegative().optional(),
});

function buildDraftSyncResponse(
  result: Awaited<ReturnType<typeof saveRemoteProjectDraft>>,
) {
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        conflict: true,
        draft: result.snapshot.draft,
        manifest: result.snapshot.manifest,
        project: result.snapshot.project,
        revision: result.snapshot.revision,
        updatedAt: result.snapshot.updatedAt,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    draft: result.snapshot.draft,
    manifest: result.snapshot.manifest,
    project: result.snapshot.project,
    revision: result.snapshot.revision,
    updatedAt: result.snapshot.updatedAt,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const snapshot = await getRemoteProjectDraftSnapshot(projectId);
  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    draft: snapshot.draft,
    manifest: snapshot.manifest,
    project: snapshot.project,
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = patchDraftSchema.parse(await request.json());
  const result = await saveRemoteProjectDraft(projectId, body.draft, {
    baseRevision: body.baseRevision,
  });

  return buildDraftSyncResponse(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = patchDraftSchema.parse(await request.json());
  const result = await saveRemoteProjectDraft(projectId, body.draft, {
    baseRevision: body.baseRevision,
  });

  return buildDraftSyncResponse(result);
}
