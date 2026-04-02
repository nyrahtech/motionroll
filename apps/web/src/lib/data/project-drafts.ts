import { and, eq } from "drizzle-orm";
import {
  type ProjectDraftDocument,
  type ProjectDraftDocumentInput,
} from "@motionroll/shared";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { buildProjectManifest } from "@/lib/manifest";
import {
  buildProjectDraftDocument,
  parseProjectDraftDocument,
  serializeProjectDraftDocument,
} from "@/lib/project-draft";
import { getProjectById } from "./projects";

export type RemoteProjectDraftSnapshot = {
  draft: ProjectDraftDocument;
  revision: number;
  updatedAt: string;
};

type SaveProjectDraftResult =
  | { ok: true; snapshot: RemoteProjectDraftSnapshot }
  | { ok: false; conflict: true; snapshot: RemoteProjectDraftSnapshot }
  | { ok: false; notFound: true };

function getNextProjectStatus(project: {
  assets: Array<{ kind: string }>;
  publishTargets: Array<{ publishedAt: Date | null }>;
}) {
  return project.publishTargets.some((t) => t.publishedAt)
    ? "ready"
    : project.assets.some((a) =>
        a.kind === "frame_sequence" || a.kind === "frame" || a.kind === "media_video",
      )
      ? "ready"
      : "draft";
}

export async function getRemoteProjectDraftSnapshot(
  projectId: string,
  userId: string,
): Promise<RemoteProjectDraftSnapshot | null> {
  const project = await getProjectById(projectId, userId);
  if (!project) return null;

  const draft = project.draftJson
    ? parseProjectDraftDocument(project.draftJson)
    : buildProjectDraftDocument(
        project,
        project.lastManifest ?? (await buildProjectManifest(projectId, { userId })),
      );

  return {
    draft,
    revision: project.draftRevision ?? 0,
    updatedAt: (project.lastSavedAt ?? project.updatedAt ?? new Date()).toISOString(),
  };
}

export async function saveRemoteProjectDraft(
  projectId: string,
  userId: string,
  draftInput: ProjectDraftDocumentInput,
  options: { baseRevision?: number } = {},
): Promise<SaveProjectDraftResult> {
  const draft = parseProjectDraftDocument(draftInput);

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
    with: { assets: true, publishTargets: true },
  });

  if (!project) {
    return { ok: false, notFound: true };
  }

  if (
    typeof options.baseRevision === "number" &&
    options.baseRevision !== project.draftRevision
  ) {
    const snapshot = await getRemoteProjectDraftSnapshot(projectId, userId);
    if (!snapshot) {
      return { ok: false, notFound: true };
    }
    return { ok: false, conflict: true, snapshot };
  }

  const now = new Date();
  const nextRevision = (project.draftRevision ?? 0) + 1;

  await db
    .update(projects)
    .set({
      title: draft.title,
      selectedPreset: draft.presetId,
      status: getNextProjectStatus(project),
      failureReason: null,
      draftJson: serializeProjectDraftDocument(draft),
      draftRevision: nextRevision,
      lastSavedAt: now,
      updatedAt: now,
    })
    .where(eq(projects.id, project.id));

  const snapshot = await getRemoteProjectDraftSnapshot(projectId, userId);
  if (!snapshot) {
    return { ok: false, notFound: true };
  }

  return {
    ok: true,
    snapshot: { ...snapshot, revision: nextRevision, updatedAt: now.toISOString() },
  };
}
