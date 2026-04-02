import { NextResponse } from "next/server";
import { CheckpointPushRequestSchema } from "@motionroll/shared";
import { requireAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import {
  getRemoteProjectDraftSnapshot,
  saveRemoteProjectDraft,
} from "@/lib/data/project-drafts";
import { UnsupportedLegacyProjectDraftError } from "../../../../../lib/project-draft";

export const dynamic = "force-dynamic";

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
  action: "load" | "save",
) {
  if (!result.ok && "notFound" in result && result.notFound) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!result.ok && "conflict" in result && result.conflict) {
    return NextResponse.json(
      {
        ok: false,
        conflict: true,
        revision: result.snapshot.revision,
        updatedAt: result.snapshot.updatedAt,
      },
      { status: 409 },
    );
  }
  if (result.ok) {
    return NextResponse.json(
      action === "save"
        ? {
            ok: true,
            revision: result.snapshot.revision,
            updatedAt: result.snapshot.updatedAt,
          }
        : {
            ok: true,
            draft: result.snapshot.draft,
            revision: result.snapshot.revision,
            updatedAt: result.snapshot.updatedAt,
          },
    );
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
    if (error instanceof UnsupportedLegacyProjectDraftError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 409 },
      );
    }
    return buildDraftUnavailableResponse(projectId, "load", error);
  }
  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    draft: snapshot.draft,
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const bodyResult = await parseBody(request, CheckpointPushRequestSchema);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;
  let result: Awaited<ReturnType<typeof saveRemoteProjectDraft>>;
  try {
    result = await saveRemoteProjectDraft(projectId, userId, body.draft, {
      baseRevision: body.baseRevision,
    });
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
    return buildDraftUnavailableResponse(projectId, "save", error);
  }
  return buildDraftSyncResponse(result, "save");
}
