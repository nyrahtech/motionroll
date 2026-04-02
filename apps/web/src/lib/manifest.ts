import { presetDefinitionMap } from "@motionroll/shared";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projects,
  publishTargets,
} from "@/db/schema";
import { env } from "@/lib/env";
import { getDerivedAssetsSnapshot } from "@/lib/project-assets";
import {
  buildCompatibilitySectionFromDraft,
  buildPublishTargetSummary,
  validateProjectManifest,
} from "./manifest-helpers";
import {
  buildProjectDraftDocument,
  createProjectDraftDocument,
  parseProjectDraftDocument,
} from "./project-draft";

type BuildProjectManifestOptions = {
  userId?: string;
  publishVersion?: number;
  persistDraftManifest?: boolean;
  persistPublishedTarget?: boolean;
  publishTargetReady?: boolean;
  publishedAt?: Date;
  assetsOverride?: Array<{
    kind: string;
    storageKey: string;
    publicUrl: string;
    metadata: unknown;
    variants: Array<{ kind: string; publicUrl: string; metadata: unknown }>;
  }>;
  publishedVersionId?: string;
};

export async function buildProjectManifest(
  projectId: string,
  options: BuildProjectManifestOptions = {},
) {
  const whereClause = options.userId
    ? and(eq(projects.id, projectId), eq(projects.ownerId, options.userId))
    : eq(projects.id, projectId);

  const project = await db.query.projects.findFirst({
    where: whereClause,
    with: {
      assets: { with: { variants: true } },
      publishTargets: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const hostedTarget = project.publishTargets.find((t) => t.targetType === "hosted_embed");
  const publishVersion = options.publishVersion ?? project.publishVersion;
  const draft = project.draftJson
    ? parseProjectDraftDocument(project.draftJson)
    : project.lastManifest
      ? buildProjectDraftDocument(
          {
            title: project.title,
            selectedPreset: project.selectedPreset,
          },
          project.lastManifest as never,
        )
      : createProjectDraftDocument({
          title: project.title,
          presetId: project.selectedPreset,
          scrollHeightVh:
            presetDefinitionMap.get(project.selectedPreset)?.defaults.common.sectionHeightVh ?? 240,
          scrubStrength:
            presetDefinitionMap.get(project.selectedPreset)?.defaults.common.scrubStrength ?? 1,
          frameRange:
            presetDefinitionMap.get(project.selectedPreset)?.defaults.common.frameRange ?? {
              start: 0,
              end: 180,
            },
          bookmarkTitle: "Hero",
        });
  const derivedAssets = options.assetsOverride ?? getDerivedAssetsSnapshot(project.assets);
  const compatibilitySection = buildCompatibilitySectionFromDraft({
    draft,
    assets: derivedAssets,
  });

  const publishTarget = buildPublishTargetSummary({
    slug: hostedTarget?.slug ?? project.slug,
    targetType: "hosted_embed",
    version: publishVersion,
    previewUrl: `${env.PUBLISH_EMBED_BASE_URL}/${hostedTarget?.slug ?? project.slug}`,
    isReady: options.publishTargetReady ?? hostedTarget?.isReady ?? false,
    publishedVersionId: options.publishedVersionId,
    publishedAt: (options.publishedAt ?? hostedTarget?.publishedAt)?.toISOString(),
  });

  const manifest = validateProjectManifest({
    version: "2.0.0",
    project: {
      id: project.id,
      slug: hostedTarget?.slug ?? project.slug,
      title: draft.title,
      ownerId: project.ownerId,
      publishVersion,
      latestPublishVersion: project.latestPublishVersion,
      lastPublishedAt: project.lastPublishedAt?.toISOString(),
      previewUrl: publishTarget.previewUrl,
    },
    publishTarget,
    selectedPreset: draft.presetId,
    canvas: {
      id: draft.canvas.id ?? compatibilitySection.id,
      presetId: draft.presetId,
      title: draft.bookmarks[0]?.title ?? compatibilitySection.title,
      frameAssets: compatibilitySection.frameAssets,
      frameCount: compatibilitySection.frameCount,
      progressMapping: compatibilitySection.progressMapping,
      backgroundColor: draft.canvas.backgroundColor ?? compatibilitySection.backgroundColor,
      backgroundTrack: draft.canvas.backgroundTrack,
      fallback: compatibilitySection.fallback,
      motion: {
        ...compatibilitySection.motion,
        sectionHeightVh: draft.canvas.scrollHeightVh,
        scrubStrength: draft.canvas.scrubStrength,
      },
      presetConfig: compatibilitySection.presetConfig,
      runtimeProfile: compatibilitySection.runtimeProfile,
    },
    bookmarks: draft.bookmarks,
    layers: draft.layers,
    generatedAt: (options.publishedAt ?? project.updatedAt).toISOString(),
  });

  if (options.persistDraftManifest ?? true) {
    await db.update(projects).set({ lastManifest: manifest }).where(eq(projects.id, project.id));
  }

  if (options.persistPublishedTarget && hostedTarget) {
    await db
      .update(publishTargets)
      .set({
        isReady: options.publishTargetReady ?? true,
        manifest,
        version: publishVersion,
        publishedAt: options.publishedAt ?? hostedTarget.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(publishTargets.id, hostedTarget.id));
  }

  return manifest;
}
