import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projectMoments,
  projectOverlays,
  projectSections,
  projectTransitions,
  projects,
  publishTargets,
} from "@/db/schema";
import { env } from "@/lib/env";
import { getDerivedAssetsSnapshot } from "@/lib/project-assets";
import {
  buildPublishTargetSummary,
  buildSectionManifest,
  validateProjectManifest,
} from "./manifest-helpers";
import { buildSectionValuesFromDraft, parseProjectDraftDocument } from "./project-draft";

type BuildProjectManifestOptions = {
  /** userId to scope the ownership check. If omitted, no ownership filter is applied (publish-read path). */
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
  // If userId is provided, scope to that owner (editor/API paths).
  // If not provided (e.g. public embed read path), look up by projectId alone.
  const whereClause = options.userId
    ? and(eq(projects.id, projectId), eq(projects.ownerId, options.userId))
    : eq(projects.id, projectId);

  const project = await db.query.projects.findFirst({
    where: whereClause,
    with: {
      sections: { orderBy: [asc(projectSections.sortOrder)] },
      assets: { with: { variants: true } },
      publishTargets: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const hostedTarget = project.publishTargets.find((t) => t.targetType === "hosted_embed");
  const publishVersion = options.publishVersion ?? project.publishVersion;
  const draft = project.draftJson ? parseProjectDraftDocument(project.draftJson) : null;
  const baseSection = project.sections[0];
  const draftSection = draft && baseSection ? buildSectionValuesFromDraft(baseSection, draft) : null;

  const sections = await Promise.all(
    (draftSection ? [draftSection] : project.sections).map(async (section) => {
      const overlays = await db.query.projectOverlays.findMany({
        where: eq(projectOverlays.projectSectionId, section.id),
        orderBy: [asc(projectOverlays.sortOrder)],
      });
      const moments = await db.query.projectMoments.findMany({
        where: eq(projectMoments.projectSectionId, section.id),
        orderBy: [asc(projectMoments.sortOrder)],
      });
      const transitions = await db.query.projectTransitions.findMany({
        where: eq(projectTransitions.projectSectionId, section.id),
        orderBy: [asc(projectTransitions.sortOrder)],
      });

      const resolvedSection = {
        id: section.id,
        presetId: section.presetId ?? project.selectedPreset,
        title: section.title,
        commonConfig: {
          sectionHeightVh: section.commonConfig.sectionHeightVh,
          scrubStrength: section.commonConfig.scrubStrength,
          frameRange: section.commonConfig.frameRange ?? { start: 0, end: 180 },
          fallbackBehavior: section.commonConfig.fallbackBehavior ?? {
            mobile: "sequence",
            reducedMotion: "poster",
          },
          motion: section.commonConfig.motion ?? {
            easing: "power2.out",
            pin: true,
            preloadWindow: 6,
          },
        },
        presetConfig: (section.presetConfig ?? {}) as Record<string, string | number | boolean | string[]>,
      };

      const resolvedOverlays =
        draftSection && section.id === draftSection.id
          ? draftSection.overlays.map((overlay) => ({
              overlayKey: overlay.overlayKey,
              timing: overlay.timing,
              content: overlay.content,
            }))
          : overlays;

      return buildSectionManifest({
        section: resolvedSection,
        overlays: resolvedOverlays,
        moments,
        transitions: transitions.map((transition) => ({
          ...transition,
          preset: transition.preset as "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve",
          easing: transition.easing as "linear" | "ease-out" | "ease-in-out" | "back-out" | "expo-out",
        })),
        assets: options.assetsOverride ?? getDerivedAssetsSnapshot(project.assets),
      });
    }),
  );

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
    version: "1.0.0",
    project: {
      id: project.id,
      slug: hostedTarget?.slug ?? project.slug,
      title: draft?.title ?? project.title,
      ownerId: project.ownerId,
      publishVersion,
      latestPublishVersion: project.latestPublishVersion,
      lastPublishedAt: project.lastPublishedAt?.toISOString(),
      previewUrl: publishTarget.previewUrl,
    },
    publishTarget,
    selectedPreset: draft?.presetId ?? project.selectedPreset,
    sections,
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
