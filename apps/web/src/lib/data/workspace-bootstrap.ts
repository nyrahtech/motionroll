import { type ProcessingJobPayload, presetDefinitionMap, presetDefinitions } from "@motionroll/shared";
import { and, eq, like } from "drizzle-orm";
import { buildProjectManifest } from "@/lib/manifest";
import { demoProjectSeeds } from "@/lib/demo-projects";
import { logger } from "@/lib/logger";
import { slugify } from "@/lib/utils";
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
  users,
} from "@/db/schema";
import type { AuthUser } from "@/lib/auth";

const WORKSPACE_BOOTSTRAP_RETRY_MS = 30_000;
const PRIMARY_DEMO_PROJECT = demoProjectSeeds[0];

type FailedBootstrapState = {
  retryAfter: number;
  reason: string;
};

type WorkspaceBootstrapMode = "minimal" | "full";

type PendingWorkspaceBootstrap = {
  mode: WorkspaceBootstrapMode;
  promise: Promise<void>;
};

type DemoWorkspaceSeedOptions = {
  finalizePublishedState?: boolean;
  includeProcessingJob?: boolean;
  frameVariantKinds?: Array<"desktop" | "tablet" | "mobile">;
  includeFrameAssets?: boolean;
};

function getFileExtension(url: string) {
  const match = url.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  return match?.[1] ?? "";
}

function getImageMimeType(url: string) {
  const extension = getFileExtension(url);
  if (extension === "webp") {
    return "image/webp";
  }
  if (extension === "png") {
    return "image/png";
  }
  return "image/jpeg";
}

function getImageFormat(url: string) {
  const extension = getFileExtension(url);
  if (extension === "webp" || extension === "png") {
    return extension;
  }
  return "jpg";
}

function isVideoUrl(url: string) {
  return /(?:\.mp4|\.mov|\.webm)(?:\?|$)/i.test(url);
}

function buildUserDemoSlug(baseSlug: string, userId: string) {
  const suffix = slugify(userId).replace(/^[-]+|[-]+$/g, "").slice(0, 18) || "user";
  return `${baseSlug}-${suffix}`;
}

export async function seedTemplates() {
  for (const preset of presetDefinitions) {
    await db
      .insert(templates)
      .values({
        id: preset.id,
        presetId: preset.id,
        label: preset.label,
        description: preset.description,
        thumbnailUrl: preset.previewThumbnail,
        defaults: preset.defaults,
        exposedControls: preset.exposedControls,
        advancedControls: preset.advancedControls,
        seededOverlays: preset.seededOverlays,
      })
      .onConflictDoUpdate({
        target: templates.id,
        set: {
          label: preset.label,
          description: preset.description,
          thumbnailUrl: preset.previewThumbnail,
          defaults: preset.defaults,
          exposedControls: preset.exposedControls,
          advancedControls: preset.advancedControls,
          seededOverlays: preset.seededOverlays,
        },
      });
  }
}

let templatesSeeded = false;
let pendingTemplateSeed: Promise<void> | null = null;

async function ensureTemplatesSeeded() {
  if (templatesSeeded) {
    return;
  }

  if (pendingTemplateSeed) {
    return pendingTemplateSeed;
  }

  pendingTemplateSeed = (async () => {
    try {
      await seedTemplates();
      templatesSeeded = true;
    } finally {
      pendingTemplateSeed = null;
    }
  })();

  return pendingTemplateSeed;
}

export async function upsertWorkspaceUser(user: AuthUser) {
  await db
    .insert(users)
    .values({
      id: user.userId,
      email: user.email,
      name: user.name,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        name: user.name,
      },
    });
}

export async function seedDemoWorkspaceForUser(
  user: AuthUser,
  demos: readonly (typeof demoProjectSeeds)[number][] = demoProjectSeeds,
  options: DemoWorkspaceSeedOptions = {},
) {
  const {
    finalizePublishedState = true,
    includeProcessingJob = true,
    frameVariantKinds = ["desktop", "tablet", "mobile"],
    includeFrameAssets = true,
  } = options;

  for (const demo of demos) {
    const preset = presetDefinitionMap.get(demo.presetId);
    if (!preset) {
      continue;
    }

    const projectSlug = buildUserDemoSlug(demo.slug, user.userId);

    const [project] = await db
      .insert(projects)
      .values({
        ownerId: user.userId,
        templateId: demo.presetId,
        title: demo.title,
        slug: projectSlug,
        selectedPreset: demo.presetId,
        status: "ready",
      })
      .returning();

    if (!project) {
      throw new Error(`Failed to seed demo project: ${demo.slug}`);
    }

    const [section] = await db
      .insert(projectSections)
      .values({
        projectId: project.id,
        title: demo.sectionTitle,
        sortOrder: 0,
        presetId: demo.presetId,
        commonConfig: {
          ...preset.defaults.common,
          sectionHeightVh: demo.sectionHeightVh,
          scrubStrength: demo.scrubStrength,
          fallbackBehavior: demo.fallbackBehavior ?? preset.defaults.common.fallbackBehavior,
          frameRange: {
            start: 0,
            end: demo.frameRangeEnd,
          },
          text: demo.commonText,
          cta: demo.cta,
        },
        presetConfig: preset.defaults.preset,
      })
      .returning();

    if (!section) {
      throw new Error(`Failed to seed section for demo: ${demo.slug}`);
    }

    await db.insert(projectOverlays).values(
      demo.overlays.map((overlay, index) => ({
        projectSectionId: section.id,
        overlayKey: overlay.id,
        sortOrder: index,
        timing: overlay.timing,
        content: overlay.content,
      })),
    );

    let sourceAssetId: string | undefined;
    if (isVideoUrl(demo.sourceVideoUrl)) {
      const [sourceAsset] = await db
        .insert(projectAssets)
        .values({
          projectId: project.id,
          ownerId: user.userId,
          kind: "source_video",
          sourceType: "video",
          sourceOrigin: "upload",
          storageKey: demo.sourceVideoUrl.replace(/^\//, ""),
          publicUrl: demo.sourceVideoUrl,
          metadata: {
            mimeType: "video/mp4",
            bytes: demo.sourceBytes ?? 0,
            originalFilename: `${demo.slug}.mp4`,
            retainedSource: true,
            durationMs: demo.durationMs,
            width: demo.sourceWidth ?? demo.width,
            height: demo.sourceHeight ?? demo.height,
          },
          isPrimary: true,
        })
        .returning();

      sourceAssetId = sourceAsset?.id;
    }

    const [frameSequenceAsset] = await db
      .insert(projectAssets)
      .values({
        projectId: project.id,
        ownerId: user.userId,
        kind: "frame_sequence",
        storageKey: `demo/${projectSlug}/sequence.json`,
        publicUrl: demo.posterUrl,
        metadata: {
          mimeType: "application/json",
          bytes: 0,
          frameCount: demo.frameCount ?? demo.frameUrls.length,
          frameRate: demo.frameRate,
          durationMs: demo.durationMs,
          width: demo.width ?? 1440,
          height: demo.height ?? 900,
        },
      })
      .returning();

    const [posterAsset] = await db
      .insert(projectAssets)
      .values({
        projectId: project.id,
        ownerId: user.userId,
        kind: "poster",
        sourceType: "video",
        sourceOrigin: "upload",
        storageKey: demo.posterUrl.replace(/^\//, ""),
        publicUrl: demo.posterUrl,
        metadata: {
          mimeType: getImageMimeType(demo.posterUrl),
          bytes: 0,
          width: demo.width ?? 1440,
          height: demo.height ?? 900,
        },
      })
      .returning();

    if (!frameSequenceAsset || !posterAsset) {
      throw new Error(`Failed to seed assets for demo: ${demo.slug}`);
    }

    await db.insert(assetVariants).values({
      assetId: posterAsset.id,
      kind: "poster",
      storageKey: posterAsset.storageKey,
      publicUrl: posterAsset.publicUrl,
      metadata: {
        kind: "poster",
        width: demo.width ?? 1440,
        height: demo.height ?? 900,
        bytes: 0,
        format: getImageFormat(demo.posterUrl),
      },
    });

    if (demo.fallbackVideoUrl) {
      await db.insert(projectAssets).values({
        projectId: project.id,
        ownerId: user.userId,
        kind: "fallback_video",
        sourceType: "video",
        sourceOrigin: "upload",
        storageKey: demo.fallbackVideoUrl.replace(/^\//, ""),
        publicUrl: demo.fallbackVideoUrl,
        metadata: {
          mimeType: "video/mp4",
          bytes: 0,
          durationMs: demo.durationMs,
          width: demo.width ?? 1440,
          height: demo.height ?? 900,
        },
      });
    }

    if (includeFrameAssets) {
      const frameAssets = await db
        .insert(projectAssets)
        .values(
          demo.frameUrls.map((frameUrl, index) => ({
            projectId: project.id,
            ownerId: user.userId,
            kind: "frame" as const,
            sourceType: "video" as const,
            sourceOrigin: "upload" as const,
            storageKey: frameUrl.replace(/^\//, ""),
            publicUrl: frameUrl,
            metadata: {
              mimeType: getImageMimeType(frameUrl),
              bytes: 0,
              width: demo.width ?? 1440,
              height: demo.height ?? 900,
              frameIndex: index,
            },
          })),
        )
        .returning();

      const frameVariantRows = frameAssets.flatMap((frameAsset) =>
        frameVariantKinds.map((kind) => ({
          assetId: frameAsset.id,
          kind,
          storageKey: frameAsset.storageKey,
          publicUrl: frameAsset.publicUrl,
          metadata: {
            kind,
            width:
              kind === "desktop"
                ? demo.width ?? 1440
                : kind === "tablet"
                  ? Math.min(demo.width ?? 1440, 1080)
                  : Math.min(demo.width ?? 1440, 720),
            height:
              kind === "desktop"
                ? demo.height ?? 900
                : Math.round(
                    ((kind === "tablet"
                      ? Math.min(demo.width ?? 1440, 1080)
                      : Math.min(demo.width ?? 1440, 720)) *
                      (demo.height ?? 900)) /
                      Math.max(demo.width ?? 1440, 1),
                  ),
            bytes: 0,
            format: getImageFormat(frameAsset.publicUrl),
          },
        })),
      );

      if (frameVariantRows.length > 0) {
        await db.insert(assetVariants).values(frameVariantRows);
      }
    }

    if (includeProcessingJob && sourceAssetId) {
      const payload: ProcessingJobPayload = {
        projectId: project.id,
        assetId: sourceAssetId,
        sourceType: "video",
        sourceOrigin: "upload",
        retentionPolicy: "keep_source",
        outputTargets: demo.fallbackVideoUrl
          ? ["frames", "poster", "fallback_video", "manifest_fragment"]
          : ["frames", "poster", "manifest_fragment"],
      };

      await db.insert(processingJobs).values({
        projectId: project.id,
        assetId: sourceAssetId,
        status: "completed",
        payload,
        outputs: {
          posterUrl: posterAsset.publicUrl,
          fallbackVideoUrl: demo.fallbackVideoUrl,
          frameVariantBasePath:
            demo.frameUrls[0]?.replace(/\/frame-\d+\.(jpg|jpeg|png|webp)$/i, "") ??
            `demo/${projectSlug}/frames`,
          frameCount: demo.frameCount ?? demo.frameUrls.length,
        },
      });
    }

    await db.insert(publishTargets).values([
      {
        projectId: project.id,
        targetType: "hosted_embed",
        slug: projectSlug,
      },
      {
        projectId: project.id,
        targetType: "script_embed",
        slug: `${projectSlug}-script`,
      },
    ]);

    if (finalizePublishedState) {
      const publishedAt = new Date();
      const manifest = await buildProjectManifest(project.id, { userId: user.userId });

      await db
        .update(projects)
        .set({
          status: "published",
          lastManifest: manifest,
          updatedAt: publishedAt,
        })
        .where(eq(projects.id, project.id));

      await db
        .update(publishTargets)
        .set({
          isReady: true,
          manifest,
          publishedAt,
          updatedAt: publishedAt,
        })
        .where(eq(publishTargets.projectId, project.id));
    }
  }
}

async function getExistingUserProject(userId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.ownerId, userId),
    columns: { id: true },
  });
}

async function getUserDemoProjectSlugs(userId: string) {
  const rows = await db.query.projects.findMany({
    where: and(eq(projects.ownerId, userId), like(projects.slug, "demo-%")),
    columns: { slug: true },
  });
  return new Set(rows.map((row) => row.slug));
}

async function seedPrimaryDemoWorkspaceForUser(user: AuthUser) {
  if (!PRIMARY_DEMO_PROJECT) {
    return;
  }

  await seedDemoWorkspaceForUser(user, [PRIMARY_DEMO_PROJECT], {
    finalizePublishedState: false,
    includeProcessingJob: false,
    frameVariantKinds: ["desktop"],
    includeFrameAssets: false,
  });
}

async function seedMissingDemoWorkspaceForUser(user: AuthUser) {
  const existingDemoSlugs = await getUserDemoProjectSlugs(user.userId);
  const missingDemos = demoProjectSeeds.filter((demo) => {
    const expectedSlug = buildUserDemoSlug(demo.slug, user.userId);
    return !existingDemoSlugs.has(expectedSlug);
  });

  if (missingDemos.length === 0) {
    return;
  }

  await seedDemoWorkspaceForUser(user, missingDemos);
}

function modeSatisfiesBootstrap(
  completedMode: WorkspaceBootstrapMode,
  requestedMode: WorkspaceBootstrapMode,
) {
  return completedMode === "full" || completedMode === requestedMode;
}

const bootstrappedUserModes = new Map<string, WorkspaceBootstrapMode>();
const pendingWorkspaceBootstraps = new Map<string, PendingWorkspaceBootstrap>();
const failedWorkspaceBootstraps = new Map<string, FailedBootstrapState>();

export async function ensureUserWorkspace(
  user: AuthUser,
  options?: { mode?: WorkspaceBootstrapMode },
): Promise<void> {
  const requestedMode = options?.mode ?? "full";
  const completedMode = bootstrappedUserModes.get(user.userId);
  if (completedMode && modeSatisfiesBootstrap(completedMode, requestedMode)) {
    return;
  }

  const currentFailure = failedWorkspaceBootstraps.get(user.userId);
  const now = Date.now();
  if (currentFailure && currentFailure.retryAfter > now) {
    return;
  }

  const pendingBootstrap = pendingWorkspaceBootstraps.get(user.userId);
  if (pendingBootstrap) {
    if (modeSatisfiesBootstrap(pendingBootstrap.mode, requestedMode)) {
      return pendingBootstrap.promise;
    }

    await pendingBootstrap.promise;
    return ensureUserWorkspace(user, options);
  }

  const bootstrapPromise = (async () => {
    try {
      await upsertWorkspaceUser(user);
      if (requestedMode === "full") {
        await ensureTemplatesSeeded();
      }

      const existingProject = await getExistingUserProject(user.userId);
      if (!existingProject) {
        if (requestedMode === "minimal") {
          await seedPrimaryDemoWorkspaceForUser(user);
        } else {
          await seedDemoWorkspaceForUser(user);
        }
      } else if (requestedMode === "full" && PRIMARY_DEMO_PROJECT) {
        const primaryDemoSlug = buildUserDemoSlug(PRIMARY_DEMO_PROJECT.slug, user.userId);
        const hasPrimaryDemo = await db.query.projects.findFirst({
          where: and(eq(projects.ownerId, user.userId), eq(projects.slug, primaryDemoSlug)),
          columns: { id: true },
        });

        if (hasPrimaryDemo) {
          await seedMissingDemoWorkspaceForUser(user);
        }
      }

      failedWorkspaceBootstraps.delete(user.userId);
      bootstrappedUserModes.set(user.userId, requestedMode);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failedWorkspaceBootstraps.set(user.userId, {
        retryAfter: Date.now() + WORKSPACE_BOOTSTRAP_RETRY_MS,
        reason,
      });
      logger.warn("Workspace bootstrap failed; using degraded project shell until retry", {
        userId: user.userId,
        retryInMs: WORKSPACE_BOOTSTRAP_RETRY_MS,
        reason,
      });
    } finally {
      pendingWorkspaceBootstraps.delete(user.userId);
    }
  })();

  pendingWorkspaceBootstraps.set(user.userId, {
    mode: requestedMode,
    promise: bootstrapPromise,
  });
  return bootstrapPromise;
}

export async function removeDemoWorkspaceForUser(userId: string) {
  await db.delete(projects).where(like(projects.slug, `demo-%${slugify(userId).replace(/^[-]+|[-]+$/g, "").slice(0, 18)}%`));
}
