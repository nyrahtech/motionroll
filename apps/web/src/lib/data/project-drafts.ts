import { and, eq } from "drizzle-orm";
import {
  ProjectDraftDocumentSchema,
  type ProjectDraftDocument,
  type ProjectManifest,
} from "@motionroll/shared";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { buildProjectManifest } from "@/lib/manifest";
import { buildProjectDraftDocument, parseProjectDraftDocument } from "@/lib/project-draft";
import { getProjectById } from "./projects";

export type RemoteProjectDraftSnapshot = {
  draft: ProjectDraftDocument;
  manifest: ProjectManifest;
  project: Awaited<ReturnType<typeof getProjectById>>;
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
    : project.assets.some((a) => a.kind === "frame_sequence" || a.kind === "frame")
      ? "ready"
      : "draft";
}

export async function getRemoteProjectDraftSnapshot(
  projectId: string,
  userId: string,
): Promise<RemoteProjectDraftSnapshot | null> {
  const project = await getProjectById(projectId, userId);
  if (!project) return null;

  const manifest = await buildProjectManifest(projectId, { userId });
  const draft = project.draftJson
    ? parseProjectDraftDocument(project.draftJson)
    : buildProjectDraftDocument(project, manifest);

  return {
    draft,
    manifest,
    project,
    revision: project.draftRevision ?? 0,
    updatedAt: (project.lastSavedAt ?? project.updatedAt ?? new Date()).toISOString(),
  };
}

export async function saveRemoteProjectDraft(
  projectId: string,
  userId: string,
  draftInput: ProjectDraftDocument,
  options: { baseRevision?: number } = {},
): Promise<SaveProjectDraftResult> {
  const draft = ProjectDraftDocumentSchema.parse(draftInput);

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
    with: { sections: true, assets: true, publishTargets: true },
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
      draftJson: draft,
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
