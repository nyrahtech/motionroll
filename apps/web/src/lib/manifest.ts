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
import { LOCAL_OWNER } from "@/lib/data/local-owner";
import { env } from "@/lib/env";
import { getDerivedAssetsSnapshot } from "@/lib/project-assets";
import {
  buildPublishTargetSummary,
  buildSectionManifest,
  validateProjectManifest,
} from "./manifest-helpers";

type BuildProjectManifestOptions = {
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
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
    with: {
      sections: {
        orderBy: [asc(projectSections.sortOrder)],
      },
      assets: {
        with: {
          variants: true,
        },
      },
      publishTargets: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const hostedTarget = project.publishTargets.find(
    (target) => target.targetType === "hosted_embed",
  );
  const publishVersion = options.publishVersion ?? project.publishVersion;

  const sections = await Promise.all(
    project.sections.map(async (section) => {
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

      return buildSectionManifest({
        section,
        overlays,
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
      title: project.title,
      ownerId: project.ownerId,
      publishVersion,
      latestPublishVersion: project.latestPublishVersion,
      lastPublishedAt: project.lastPublishedAt?.toISOString(),
      previewUrl: publishTarget.previewUrl,
    },
    publishTarget,
    selectedPreset: project.selectedPreset,
    sections,
    generatedAt: (options.publishedAt ?? project.updatedAt).toISOString(),
  });

  if (options.persistDraftManifest ?? true) {
    await db
      .update(projects)
      .set({
        lastManifest: manifest,
      })
      .where(eq(projects.id, project.id));
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
