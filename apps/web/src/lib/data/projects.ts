import {
  type OverlayDefinition,
  type PresetDefinition,
  type PresetId,
  type ProjectManifest,
  type ReadinessCheck,
  presetDefinitionMap,
} from "@motionroll/shared";
import { and, asc, desc, eq, isNull, like, notLike } from "drizzle-orm";
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
import { ensureLocalOwnerAndTemplates } from "./bootstrap";
import { LOCAL_OWNER } from "./local-owner";
import { buildProjectManifest } from "@/lib/manifest";
import { buildPublishReadinessChecks, summarizePublishReadiness } from "@/lib/publish/readiness";
import { getDerivedAssetsSnapshot } from "@/lib/project-assets";
import { slugify } from "@/lib/utils";

function hasRenderableMedia(
  project: {
    assets?: Array<{
      kind: string;
    }>;
  },
) {
  return (project.assets ?? []).some((asset) =>
    ["frame", "frame_sequence", "poster", "fallback_video"].includes(asset.kind),
  );
}

export async function getRecentProjects() {
  await ensureLocalOwnerAndTemplates();

  return db.query.projects.findMany({
    where: and(
      eq(projects.ownerId, LOCAL_OWNER.id),
      isNull(projects.archivedAt),
      notLike(projects.slug, "demo-%"),
    ),
    with: {
      sections: true,
      assets: true,
      template: true,
      jobs: {
        orderBy: [desc(processingJobs.createdAt)],
      },
      publishTargets: true,
    },
    orderBy: [desc(projects.lastOpenedAt), desc(projects.updatedAt)],
    limit: 8,
  });
}

export async function getArchivedProjects() {
  await ensureLocalOwnerAndTemplates();

  return db.query.projects.findMany({
    where: and(eq(projects.ownerId, LOCAL_OWNER.id), notLike(projects.slug, "demo-%")),
    with: {
      sections: true,
      assets: true,
      template: true,
      jobs: {
        orderBy: [desc(processingJobs.createdAt)],
      },
      publishTargets: true,
    },
    orderBy: [desc(projects.archivedAt), desc(projects.updatedAt)],
  }).then((rows) => rows.filter((row) => row.archivedAt));
}

export async function getDemoProjects() {
  await ensureLocalOwnerAndTemplates();

  return db.query.projects.findMany({
    where: and(eq(projects.ownerId, LOCAL_OWNER.id), isNull(projects.archivedAt), like(projects.slug, "demo-%")),
    with: {
      sections: true,
      assets: true,
      template: true,
      jobs: {
        orderBy: [desc(processingJobs.createdAt)],
      },
      publishTargets: true,
    },
    orderBy: [asc(projects.createdAt)],
  });
}

export async function getProjectSwitcherProjects() {
  await ensureLocalOwnerAndTemplates();

  return db.query.projects.findMany({
    where: and(eq(projects.ownerId, LOCAL_OWNER.id), isNull(projects.archivedAt)),
    with: {
      assets: true,
      publishTargets: true,
    },
    orderBy: [desc(projects.lastOpenedAt), desc(projects.updatedAt)],
    limit: 24,
  });
}

export async function getEditorHomeProject() {
  await ensureLocalOwnerAndTemplates();

  const [recentProject] = await db.query.projects.findMany({
    where: and(eq(projects.ownerId, LOCAL_OWNER.id), isNull(projects.archivedAt), notLike(projects.slug, "demo-%")),
    with: {
      assets: true,
    },
    orderBy: [desc(projects.lastOpenedAt), desc(projects.updatedAt)],
    limit: 1,
  });

  if (recentProject && hasRenderableMedia(recentProject)) {
    return recentProject;
  }

  const [demoProject] = await db.query.projects.findMany({
    where: and(eq(projects.ownerId, LOCAL_OWNER.id), isNull(projects.archivedAt), eq(projects.slug, "demo-motionroll-editor")),
    with: {
      assets: true,
    },
    orderBy: [desc(projects.updatedAt)],
    limit: 1,
  });

  if (demoProject) {
    return demoProject;
  }

  const [fallbackDemo] = await db.query.projects.findMany({
    where: and(eq(projects.ownerId, LOCAL_OWNER.id), isNull(projects.archivedAt), like(projects.slug, "demo-%")),
    with: {
      assets: true,
    },
    orderBy: [asc(projects.createdAt)],
    limit: 1,
  });

  return fallbackDemo ?? null;
}

export async function getTemplates() {
  await ensureLocalOwnerAndTemplates();

  return db.query.templates.findMany({
    orderBy: [asc(templates.label)],
  });
}

export async function createProjectFromPreset(presetId: PresetId, title?: string) {
  await ensureLocalOwnerAndTemplates();

  const preset = presetDefinitionMap.get(presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  const [project] = await db
    .insert(projects)
    .values({
      ownerId: LOCAL_OWNER.id,
      templateId: preset.id,
      title: title ?? preset.label,
      slug: slugify(`${preset.label}-${Date.now()}`),
      selectedPreset: preset.id,
    })
    .returning();
  if (!project) {
    throw new Error("Project insert failed.");
  }

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
  if (!section) {
    throw new Error("Project section insert failed.");
  }

  await db.insert(projectOverlays).values(
    preset.seededOverlays.map((overlay, index) => ({
      projectSectionId: section.id,
      overlayKey: overlay.id,
      sortOrder: index,
      timing: overlay.timing,
      content: overlay.content,
    })),
  );

  await db
    .insert(publishTargets)
    .values([
      {
        projectId: project.id,
        targetType: "hosted_embed",
        slug: project.slug,
      },
      {
        projectId: project.id,
        targetType: "script_embed",
        slug: `${project.slug}-script`,
      },
    ])
    .onConflictDoNothing();

  return project;
}

export async function getProjectById(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
    with: {
      sections: {
        orderBy: [asc(projectSections.sortOrder)],
        with: {
          overlays: {
            orderBy: [asc(projectOverlays.sortOrder)],
          },
        },
      },
      assets: {
        with: {
          variants: true,
        },
      },
      template: true,
      jobs: {
        orderBy: [desc(processingJobs.createdAt)],
      },
      publishTargets: true,
    },
  });

  if (!project || project.archivedAt) {
    return null;
  }

  await db
    .update(projects)
    .set({
      lastOpenedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  return {
    ...project,
    lastOpenedAt: new Date(),
  };
}

export async function getProjectPreset(
  projectId: string,
): Promise<PresetDefinition | undefined> {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
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

export async function getPublishReadiness(
  projectId: string,
): Promise<ProcessingStatusSummary> {
  const project = await getProjectById(projectId);
  if (!project) {
    return {
      ready: false,
      blockedCount: 1,
      warningCount: 0,
      checks: [
        {
          id: "project-missing",
          label: "Project lookup",
          status: "blocked",
          message: "Project was not found.",
        },
      ],
      reasons: ["Project was not found."],
    };
  }

  const checks = buildPublishReadinessChecks({
    ...project,
    assets: getDerivedAssetsSnapshot(project.assets),
  });
  return summarizePublishReadiness(checks);
}

export async function getProjectOverlayDefinitions(
  sectionId: string,
): Promise<OverlayDefinition[]> {
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

export async function switchProjectPreset(projectId: string, presetId: PresetId) {
  await ensureLocalOwnerAndTemplates();

  const preset = presetDefinitionMap.get(presetId);
  const project = await getProjectById(projectId);
  if (!project || !preset) {
    throw new Error("Project or preset not found.");
  }

  const section = project.sections[0];
  if (!section) {
    throw new Error("Project section not found.");
  }

  await db
    .update(projects)
    .set({
      selectedPreset: presetId,
      templateId: presetId,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  await db
    .update(projectSections)
    .set({
      presetId,
      title: "Primary cinematic section",
      commonConfig: preset.defaults.common,
      presetConfig: preset.defaults.preset,
      updatedAt: new Date(),
    })
    .where(eq(projectSections.id, section.id));

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

  return getProjectById(projectId);
}

export async function renameProject(projectId: string, title: string) {
  await db
    .update(projects)
    .set({
      title,
      updatedAt: new Date(),
      lastSavedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)));

  return getProjectById(projectId);
}

export async function archiveProject(projectId: string) {
  await db
    .update(projects)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)));
}

export async function restoreProject(projectId: string) {
  await db
    .update(projects)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
      lastOpenedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)));
}

export async function duplicateProject(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const [copy] = await db
    .insert(projects)
    .values({
      ownerId: project.ownerId,
      templateId: project.templateId,
      title: `${project.title} Copy`,
      slug: slugify(`${project.title}-copy-${Date.now()}`),
      selectedPreset: project.selectedPreset,
      status: "draft",
      publishVersion: 1,
      latestPublishVersion: 1,
    })
    .returning();

  if (!copy) {
    throw new Error("Project duplicate failed.");
  }

  for (const section of project.sections) {
    const [nextSection] = await db
      .insert(projectSections)
      .values({
        projectId: copy.id,
        title: section.title,
        sortOrder: section.sortOrder,
        presetId: section.presetId,
        commonConfig: section.commonConfig,
        presetConfig: section.presetConfig,
      })
      .returning();

    if (!nextSection) {
      continue;
    }

    if (section.overlays.length > 0) {
      await db.insert(projectOverlays).values(
        section.overlays.map((overlay) => ({
          projectSectionId: nextSection.id,
          overlayKey: overlay.overlayKey,
          sortOrder: overlay.sortOrder,
          timing: overlay.timing,
          content: overlay.content,
        })),
      );
    }
  }

  await db
    .insert(publishTargets)
    .values([
      {
        projectId: copy.id,
        targetType: "hosted_embed",
        slug: copy.slug,
      },
      {
        projectId: copy.id,
        targetType: "script_embed",
        slug: `${copy.slug}-script`,
      },
    ])
    .onConflictDoNothing();

  return getProjectById(copy.id);
}
