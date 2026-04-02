import {
  type OverlayDefinition,
  type PresetDefinition,
  type PresetId,
  type ProjectManifest,
  type ReadinessCheck,
  presetDefinitionMap,
} from "@motionroll/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  assetVariants,
  processingJobs,
  projects,
  publishTargets,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth";
import { demoProjectMap } from "@/lib/demo-projects";
import type { CreateProjectSource } from "../project-creation";
import { ensureUserWorkspaceById } from "./bootstrap";
import { ensureUserWorkspace } from "./workspace-bootstrap";
import { buildProjectManifest } from "@/lib/manifest";
import { buildPublishReadinessChecks, summarizePublishReadiness } from "@/lib/publish/readiness";
import { getDerivedAssetsSnapshot } from "@/lib/project-assets";
import {
  createProjectDraftDocument,
  parseProjectDraftDocument,
  serializeProjectDraftDocument,
} from "@/lib/project-draft";
import { slugify } from "@/lib/utils";

function getProjectRelations() {
  return {
    assets: { with: { variants: true as const } },
    jobs: { orderBy: [desc(processingJobs.createdAt)] },
    publishTargets: true as const,
  };
}

async function getOwnedProjectRecord(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
}

export async function getMyProjects(userId: string) {
  await ensureUserWorkspaceById(userId);
  return db.query.projects.findMany({
    where: and(eq(projects.ownerId, userId), isNull(projects.archivedAt)),
    with: getProjectRelations(),
    orderBy: [desc(projects.lastOpenedAt), desc(projects.updatedAt)],
  });
}

export async function getProjectSwitcherProjects(userId: string) {
  await ensureUserWorkspaceById(userId);
  return db.query.projects.findMany({
    where: and(eq(projects.ownerId, userId), isNull(projects.archivedAt)),
    with: { publishTargets: true },
    orderBy: [desc(projects.lastOpenedAt), desc(projects.updatedAt)],
    limit: 24,
  });
}

export async function getEditorHomeProject(userId: string) {
  await ensureUserWorkspaceById(userId, { mode: "minimal" });
  return getEditorHomeProjectAfterBootstrap(userId);
}

export async function getEditorHomeProjectAfterBootstrap(userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.ownerId, userId), isNull(projects.archivedAt)),
    columns: { id: true },
    orderBy: [desc(projects.lastOpenedAt), desc(projects.updatedAt)],
  });
}

export async function getEditorHomeProjectForUser(user: AuthUser) {
  await ensureUserWorkspace(user, { mode: "minimal" });
  return getEditorHomeProjectAfterBootstrap(user.userId);
}

type ProjectStarter = {
  presetId: PresetId;
  title: string;
  bookmarkTitle: string;
};

function getProjectStarter(source: CreateProjectSource, title?: string): ProjectStarter {
  if (source.kind === "demo") {
    const demo = demoProjectMap.get(source.demoId);
    if (!demo) {
      throw new Error(`Unknown demo project: ${source.demoId}`);
    }

    return {
      presetId: demo.starter.presetId,
      title: title ?? demo.starter.title ?? demo.title,
      bookmarkTitle: demo.starter.sectionTitle ?? "Hero",
    };
  }

  return {
    presetId: "scroll-sequence",
    title: title ?? "Untitled Project",
    bookmarkTitle: "Hero",
  };
}

function buildInitialDraftFromPreset(starter: ProjectStarter) {
  const preset = presetDefinitionMap.get(starter.presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${starter.presetId}`);
  }

  return createProjectDraftDocument({
    title: starter.title,
    presetId: preset.id,
    scrollHeightVh: preset.defaults.common.sectionHeightVh,
    scrubStrength: preset.defaults.common.scrubStrength,
    frameRange: preset.defaults.common.frameRange,
    bookmarkTitle: starter.bookmarkTitle,
    layers: preset.seededOverlays,
  });
}

export async function createProjectFromSource(userId: string, source: CreateProjectSource, title?: string) {
  await ensureUserWorkspaceById(userId);
  const starter = getProjectStarter(source, title);
  const draft = buildInitialDraftFromPreset(starter);

  const [project] = await db
    .insert(projects)
    .values({
      ownerId: userId,
      title: starter.title,
      slug: slugify(`${starter.title}-${Date.now()}`),
      selectedPreset: starter.presetId,
      draftJson: serializeProjectDraftDocument(draft),
      draftRevision: 1,
    })
    .returning();
  if (!project) throw new Error("Project insert failed.");

  await db
    .insert(publishTargets)
    .values([
      { projectId: project.id, targetType: "hosted_embed", slug: project.slug },
      { projectId: project.id, targetType: "script_embed", slug: `${project.slug}-script` },
    ])
    .onConflictDoNothing();

  return {
    ...project,
    assets: [],
    jobs: [],
    publishTargets: [],
  };
}

export async function getProjectById(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
    with: {
      assets: { with: { variants: true } },
      jobs: { orderBy: [desc(processingJobs.createdAt)] },
      publishTargets: true,
    },
  });

  if (!project || project.archivedAt) return null;

  const draft = project.draftJson ? parseProjectDraftDocument(project.draftJson) : null;

  await db.update(projects).set({ lastOpenedAt: new Date() }).where(eq(projects.id, project.id));

  return {
    ...project,
    title: draft?.title ?? project.title,
    selectedPreset: draft?.presetId ?? project.selectedPreset,
    sections: [],
    lastOpenedAt: new Date(),
  };
}

export async function getProjectPreset(projectId: string, userId: string): Promise<PresetDefinition | undefined> {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
  return project ? presetDefinitionMap.get(project.selectedPreset) : undefined;
}

export async function getProjectManifest(projectId: string): Promise<ProjectManifest> {
  return buildProjectManifest(projectId);
}

export type ProcessingStatusSummary = {
  ready: boolean;
  blockedCount: number;
  warningCount: number;
  checks: ReadinessCheck[];
  reasons: string[];
};

export async function getPublishReadiness(projectId: string, userId: string): Promise<ProcessingStatusSummary> {
  const project = await getProjectById(projectId, userId);
  if (!project) {
    return {
      ready: false,
      blockedCount: 1,
      warningCount: 0,
      checks: [{ id: "project-missing", label: "Project lookup", status: "blocked", message: "Project was not found." }],
      reasons: ["Project was not found."],
    };
  }
  const manifest = await buildProjectManifest(projectId, { userId });
  const checks = buildPublishReadinessChecks({
    ...project,
    sections: [
      {
        title: manifest.bookmarks[0]?.title ?? manifest.project.title,
        commonConfig: {
          frameRange: manifest.canvas.progressMapping.frameRange,
          fallbackBehavior: {
            mobile: manifest.canvas.fallback.mobileBehavior,
            reducedMotion: manifest.canvas.fallback.reducedMotionBehavior,
          },
          text: {
            content:
              manifest.layers
                .filter((layer) => layer.content.type === "text")
                .map((layer) => layer.content.text?.trim())
                .find((value): value is string => Boolean(value)) ?? "",
          },
          ...(manifest.canvas.backgroundTrack
            ? {
                backgroundMedia: manifest.canvas.backgroundTrack.media,
              }
            : {}),
        },
      },
    ],
    assets: getDerivedAssetsSnapshot(project.assets),
  });
  return summarizePublishReadiness(checks);
}

export async function getProjectOverlayDefinitions(_sectionId: string): Promise<OverlayDefinition[]> {
  return [];
}

export async function getFrameVariantMetadata(assetId: string) {
  return db.query.assetVariants.findMany({
    where: eq(assetVariants.assetId, assetId),
    orderBy: [desc(assetVariants.createdAt)],
  });
}

export async function switchProjectPreset(projectId: string, userId: string, presetId: PresetId) {
  await ensureUserWorkspaceById(userId);
  const preset = presetDefinitionMap.get(presetId);
  const project = await getProjectById(projectId, userId);
  if (!project || !preset) throw new Error("Project or preset not found.");

  const currentDraft = project.draftJson
    ? parseProjectDraftDocument(project.draftJson)
    : buildInitialDraftFromPreset({
        presetId,
        title: project.title,
        bookmarkTitle: "Hero",
      });

  const nextDraft = createProjectDraftDocument({
    title: currentDraft.title,
    presetId,
    scrollHeightVh: preset.defaults.common.sectionHeightVh,
    scrubStrength: preset.defaults.common.scrubStrength,
    frameRange: preset.defaults.common.frameRange,
    bookmarkTitle: currentDraft.bookmarks[0]?.title ?? "Hero",
    layers: preset.seededOverlays,
    backgroundColor: currentDraft.canvas.backgroundColor,
  });

  await db.update(projects).set({
    selectedPreset: presetId,
    draftJson: serializeProjectDraftDocument(nextDraft),
    draftRevision: (project.draftRevision ?? 0) + 1,
    updatedAt: new Date(),
  }).where(eq(projects.id, projectId));

  return getProjectById(projectId, userId);
}

export async function renameProject(projectId: string, userId: string, title: string) {
  const existingProject = await getOwnedProjectRecord(projectId, userId);
  if (!existingProject || existingProject.archivedAt) {
    return null;
  }

  const currentDraft = existingProject.draftJson
    ? parseProjectDraftDocument(existingProject.draftJson)
    : null;

  await db.update(projects).set({
    title,
    draftJson: currentDraft
      ? { ...serializeProjectDraftDocument(currentDraft), title }
      : existingProject.draftJson,
    updatedAt: new Date(),
    lastSavedAt: new Date(),
  }).where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  return getProjectById(projectId, userId);
}

export async function archiveProject(projectId: string, userId: string) {
  const existingProject = await getOwnedProjectRecord(projectId, userId);
  if (!existingProject) {
    return false;
  }
  if (existingProject.archivedAt) {
    return true;
  }
  await db.update(projects).set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  return true;
}

export async function restoreProject(projectId: string, userId: string) {
  const existingProject = await getOwnedProjectRecord(projectId, userId);
  if (!existingProject) {
    return false;
  }
  if (!existingProject.archivedAt) {
    return true;
  }
  await db.update(projects).set({ archivedAt: null, updatedAt: new Date(), lastOpenedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  return true;
}

export async function duplicateProject(projectId: string, userId: string) {
  const existingProject = await getOwnedProjectRecord(projectId, userId);
  if (!existingProject || existingProject.archivedAt) {
    return null;
  }

  const project = await getProjectById(projectId, userId);
  if (!project) return null;

  const currentDraft = existingProject.draftJson
    ? parseProjectDraftDocument(existingProject.draftJson)
    : buildInitialDraftFromPreset({
        presetId: project.selectedPreset,
        title: `${project.title} Copy`,
        bookmarkTitle: "Hero",
      });

  const [copy] = await db
    .insert(projects)
    .values({
      ownerId: userId,
      title: `${project.title} Copy`,
      slug: slugify(`${project.title}-copy-${Date.now()}`),
      selectedPreset: project.selectedPreset,
      status: "draft",
      publishVersion: 1,
      latestPublishVersion: 1,
      draftJson: {
        ...serializeProjectDraftDocument(currentDraft),
        title: `${currentDraft.title} Copy`,
      },
      draftRevision: 1,
    })
    .returning();
  if (!copy) throw new Error("Project duplicate failed.");

  await db
    .insert(publishTargets)
    .values([
      { projectId: copy.id, targetType: "hosted_embed", slug: copy.slug },
      { projectId: copy.id, targetType: "script_embed", slug: `${copy.slug}-script` },
    ])
    .onConflictDoNothing();

  return getProjectById(copy.id, userId);
}
