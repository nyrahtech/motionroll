import { NextResponse } from "next/server";
import { ProjectDraftDocumentSchema } from "@motionroll/shared";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import {
  getRemoteProjectDraftSnapshot,
  saveRemoteProjectDraft,
} from "@/lib/data/project-drafts";

export const dynamic = "force-dynamic";

const patchDraftSchema = z.object({
  draft: ProjectDraftDocumentSchema,
  baseRevision: z.number().int().nonnegative().optional(),
});

function buildDraftUnavailableResponse(
  projectId: string,
  action: "load" | "save",
  error: unknown,
) {
  logger.error("Draft service unavailable", {
    projectId,
    action,
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json(
    {
      error: "Draft temporarily unavailable",
      code: "draft_unavailable",
      retryable: true,
    },
    { status: 503 },
  );
}

function buildDraftSyncResponse(
  result: Awaited<ReturnType<typeof saveRemoteProjectDraft>>,
) {
  if (!result.ok && "notFound" in result && result.notFound) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!result.ok && "conflict" in result && result.conflict) {
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
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      draft: result.snapshot.draft,
      manifest: result.snapshot.manifest,
      project: result.snapshot.project,
      revision: result.snapshot.revision,
      updatedAt: result.snapshot.updatedAt,
    });
  }
  return NextResponse.json({ error: "Draft sync failed" }, { status: 500 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  let snapshot: Awaited<ReturnType<typeof getRemoteProjectDraftSnapshot>>;
  try {
    snapshot = await getRemoteProjectDraftSnapshot(projectId, userId);
  } catch (error) {
    return buildDraftUnavailableResponse(projectId, "load", error);
  }
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
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const bodyResult = await parseBody(request, patchDraftSchema);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;
  let result: Awaited<ReturnType<typeof saveRemoteProjectDraft>>;
  try {
    result = await saveRemoteProjectDraft(projectId, userId, body.draft, {
      baseRevision: body.baseRevision,
    });
  } catch (error) {
    return buildDraftUnavailableResponse(projectId, "save", error);
  }
  return buildDraftSyncResponse(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const bodyResult = await parseBody(request, patchDraftSchema);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;
  let result: Awaited<ReturnType<typeof saveRemoteProjectDraft>>;
  try {
    result = await saveRemoteProjectDraft(projectId, userId, body.draft, {
      baseRevision: body.baseRevision,
    });
  } catch (error) {
    return buildDraftUnavailableResponse(projectId, "save", error);
  }
  return buildDraftSyncResponse(result);
}
