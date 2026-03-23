import {
  type OverlayDefinition,
  type PresetDefinition,
  type PresetId,
  type ProjectManifest,
  type ReadinessCheck,
  presetDefinitionMap,
} from "@motionroll/shared";
import { and, asc, desc, eq, inArray, isNull, like, notLike } from "drizzle-orm";
import { db } from "@/db/client";
import {
  assetVariants,
  processingJobs,
  projectAssets,
  projectOverlays,
  projects,
  projectSections,
  publishTargets,
  templates,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth";
import { ensureUserWorkspaceById } from "./bootstrap";
import { ensureUserWorkspace } from "./workspace-bootstrap";
import { buildProjectManifest } from "@/lib/manifest";
import { buildPublishReadinessChecks, summarizePublishReadiness } from "@/lib/publish/readiness";
import { getDerivedAssetsSnapshot } from "@/lib/project-assets";
import {
  buildSectionValuesFromDraft,
  parseProjectDraftDocument,
} from "@/lib/project-draft";
import { slugify } from "@/lib/utils";

const RENDERABLE_ASSET_KINDS = ["frame", "frame_sequence", "poster", "fallback_video"] as const;

function getProjectRelations() {
  return {
    sections: {
      orderBy: [asc(projectSections.sortOrder)],
      with: {
        overlays: {
          orderBy: [asc(projectOverlays.sortOrder)],
        },
      },
    },
    assets: { with: { variants: true as const } },
    template: true as const,
    jobs: { orderBy: [desc(processingJobs.createdAt)] },
    publishTargets: true as const,
  };
}

async function getOwnedProjectRecord(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getRecentProjects(userId: string) {
  await ensureUserWorkspaceById(userId);
  return db.query.projects.findMany({
    where: and(eq(projects.ownerId, userId), isNull(projects.archivedAt), notLike(projects.slug, "demo-%")),
    with: getProjectRelations(),
    orderBy: [desc(projects.lastOpenedAt), desc(projects.updatedAt)],
    limit: 8,
  });
}

export async function getArchivedProjects(userId: string) {
  await ensureUserWorkspaceById(userId);
  return db.query.projects
    .findMany({
      where: and(eq(projects.ownerId, userId), notLike(projects.slug, "demo-%")),
      with: getProjectRelations(),
      orderBy: [desc(projects.archivedAt), desc(projects.updatedAt)],
    })
    .then((rows) => rows.filter((row) => row.archivedAt));
}

export async function getDemoProjects(userId: string) {
  await ensureUserWorkspaceById(userId);
  return db.query.projects.findMany({
    where: and(eq(projects.ownerId, userId), isNull(projects.archivedAt), like(projects.slug, "demo-%")),
    with: getProjectRelations(),
    orderBy: [asc(projects.createdAt)],
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
  const [recentProject, demoProject] = await Promise.all([
    db.query.projects.findFirst({
      where: and(
        eq(projects.ownerId, userId),
        isNull(projects.archivedAt),
        notLike(projects.slug, "demo-%"),
      ),
      columns: { id: true },
      orderBy: [desc(projects.lastOpenedAt), desc(projects.updatedAt)],
    }),
    db.query.projects.findFirst({
      where: and(
        eq(projects.ownerId, userId),
        isNull(projects.archivedAt),
        like(projects.slug, "demo-motionroll-editor%"),
      ),
      columns: { id: true },
      orderBy: [desc(projects.updatedAt)],
    }),
  ]);

  if (recentProject) {
    const recentRenderableAsset = await db.query.projectAssets.findFirst({
      where: and(
        eq(projectAssets.projectId, recentProject.id),
        inArray(projectAssets.kind, [...RENDERABLE_ASSET_KINDS]),
      ),
      columns: { id: true },
    });
    if (recentRenderableAsset) {
      return recentProject;
    }
  }

  if (demoProject) return demoProject;

  return (
    await db.query.projects.findFirst({
      where: and(
        eq(projects.ownerId, userId),
        isNull(projects.archivedAt),
        like(projects.slug, "demo-%"),
      ),
      columns: { id: true },
      orderBy: [asc(projects.createdAt)],
    })
  ) ?? null;
}

export async function getEditorHomeProjectForUser(user: AuthUser) {
  await ensureUserWorkspace(user, { mode: "minimal" });
  return getEditorHomeProjectAfterBootstrap(user.userId);
}

export async function getTemplates() {
  return db.query.templates.findMany({ orderBy: [asc(templates.label)] });
}

export async function createProjectFromPreset(userId: string, presetId: PresetId, title?: string) {
  await ensureUserWorkspaceById(userId);
  const preset = presetDefinitionMap.get(presetId);
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);

  const [project] = await db
    .insert(projects)
    .values({
      ownerId: userId,
      templateId: preset.id,
      title: title ?? preset.label,
      slug: slugify(`${preset.label}-${Date.now()}`),
      selectedPreset: preset.id,
    })
    .returning();
  if (!project) throw new Error("Project insert failed.");

  const [section] = await db
    .insert(projectSections)
    .values({
      projectId: project.id,
      title: "Primary cinematic section",
      sortOrder: 0,
      presetId: preset.id,
      commonConfig: preset.defaults.common,
      presetConfig: preset.defaults.preset,
    })
    .returning();
  if (!section) throw new Error("Project section insert failed.");

  await db.insert(projectOverlays).values(
    preset.seededOverlays.map((overlay, index) => ({
      projectSectionId: section.id,
      overlayKey: overlay.id,
      sortOrder: index,
      timing: overlay.timing,
      content: overlay.content,
    })),
  );

  const initialDraft = parseProjectDraftDocument({
    version: 1,
    title: project.title,
    presetId,
    sectionTitle: section.title,
    sectionHeightVh: preset.defaults.common.sectionHeightVh,
    scrubStrength: preset.defaults.common.scrubStrength,
    frameRangeStart: preset.defaults.common.frameRange.start,
    frameRangeEnd: preset.defaults.common.frameRange.end,
    overlays: preset.seededOverlays,
  });

  await db.update(projects).set({ draftJson: initialDraft, draftRevision: 1 }).where(eq(projects.id, project.id));

  await db
    .insert(publishTargets)
    .values([
      { projectId: project.id, targetType: "hosted_embed", slug: project.slug },
      { projectId: project.id, targetType: "script_embed", slug: `${project.slug}-script` },
    ])
    .onConflictDoNothing();

  return project;
}

export async function getProjectById(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
    with: {
      sections: {
        orderBy: [asc(projectSections.sortOrder)],
        with: { overlays: { orderBy: [asc(projectOverlays.sortOrder)] } },
      },
      assets: { with: { variants: true } },
      template: true,
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
    sections: draft
      ? [buildSectionValuesFromDraft(project.sections[0], draft)]
      : project.sections,
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
  const checks = buildPublishReadinessChecks({ ...project, assets: getDerivedAssetsSnapshot(project.assets) });
  return summarizePublishReadiness(checks);
}

export async function getProjectOverlayDefinitions(sectionId: string): Promise<OverlayDefinition[]> {
  const overlays = await db.query.projectOverlays.findMany({
    where: eq(projectOverlays.projectSectionId, sectionId),
    orderBy: [asc(projectOverlays.sortOrder)],
  });
  return overlays.map((overlay: (typeof overlays)[number]) => ({
    id: overlay.overlayKey,
    timing: overlay.timing,
    content: overlay.content,
  }));
}

export async function getFrameVariantMetadata(assetId: string) {
  return db.query.assetVariants.findMany({
    where: eq(assetVariants.assetId, assetId),
    orderBy: [asc(assetVariants.createdAt)],
  });
}

export async function switchProjectPreset(projectId: string, userId: string, presetId: PresetId) {
  await ensureUserWorkspaceById(userId);
  const preset = presetDefinitionMap.get(presetId);
  const project = await getProjectById(projectId, userId);
  if (!project || !preset) throw new Error("Project or preset not found.");

  const section = project.sections[0];
  if (!section) throw new Error("Project section not found.");

  await db.update(projects).set({ selectedPreset: presetId, templateId: presetId, updatedAt: new Date() }).where(eq(projects.id, projectId));
  await db.update(projectSections).set({
    presetId,
    title: "Primary cinematic section",
    commonConfig: preset.defaults.common,
    presetConfig: preset.defaults.preset,
    updatedAt: new Date(),
  }).where(eq(projectSections.id, section.id));

  await db.delete(projectOverlays).where(eq(projectOverlays.projectSectionId, section.id));
  await db.insert(projectOverlays).values(
    preset.seededOverlays.map((overlay, index) => ({
      projectSectionId: section.id,
      overlayKey: overlay.id,
      sortOrder: index,
      timing: overlay.timing,
      content: overlay.content,
    })),
  );

  return getProjectById(projectId, userId);
}

export async function renameProject(projectId: string, userId: string, title: string) {
  const existingProject = await getOwnedProjectRecord(projectId, userId);
  if (!existingProject || existingProject.archivedAt) {
    return null;
  }
  await db.update(projects).set({ title, updatedAt: new Date(), lastSavedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
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

  const [copy] = await db
    .insert(projects)
    .values({
      ownerId: userId,
      templateId: project.templateId,
      title: `${project.title} Copy`,
      slug: slugify(`${project.title}-copy-${Date.now()}`),
      selectedPreset: project.selectedPreset,
      status: "draft",
      publishVersion: 1,
      latestPublishVersion: 1,
    })
    .returning();
  if (!copy) throw new Error("Project duplicate failed.");

  for (const section of project.sections) {
    const nextSectionValues: typeof projectSections.$inferInsert = {
      projectId: copy.id,
      title: section.title,
      sortOrder: section.sortOrder ?? 0,
      presetId: section.presetId ?? project.selectedPreset,
      commonConfig: section.commonConfig as typeof projectSections.$inferInsert["commonConfig"],
      presetConfig: (section.presetConfig ?? {}) as typeof projectSections.$inferInsert["presetConfig"],
    };
    const [nextSection] = await db.insert(projectSections).values(nextSectionValues).returning();
    if (!nextSection) continue;

    if ((section.overlays?.length ?? 0) > 0) {
      await db.insert(projectOverlays).values(
        section.overlays!.map((overlay) => ({
          projectSectionId: nextSection.id,
          overlayKey: overlay.overlayKey,
          sortOrder: overlay.sortOrder ?? 0,
          timing: overlay.timing,
          content: overlay.content,
        })),
      );
    }
  }

  await db
    .insert(publishTargets)
    .values([
      { projectId: copy.id, targetType: "hosted_embed", slug: copy.slug },
      { projectId: copy.id, targetType: "script_embed", slug: `${copy.slug}-script` },
    ])
    .onConflictDoNothing();

  return getProjectById(copy.id, userId);
}
