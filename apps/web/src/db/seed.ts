import "@/lib/load-env";
import { presetDefinitionMap, presetDefinitions, type ProcessingJobPayload } from "@motionroll/shared";
import { eq, like } from "drizzle-orm";
import { buildProjectManifest } from "@/lib/manifest";
import { LOCAL_OWNER } from "@/lib/data/local-owner";
import { demoProjectSeeds } from "@/lib/demo-projects";
import { db } from "./client";
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
} from "./schema";

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

async function seedTemplates() {
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

async function seedDemoProjects() {
  await db.delete(projects).where(like(projects.slug, "demo-%"));

  for (const demo of demoProjectSeeds) {
    const preset = presetDefinitionMap.get(demo.presetId);
    if (!preset) {
      continue;
    }

    const [project] = await db
      .insert(projects)
      .values({
        ownerId: LOCAL_OWNER.id,
        templateId: demo.presetId,
        title: demo.title,
        slug: demo.slug,
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

    const [sourceAsset] = await db
      .insert(projectAssets)
      .values({
        projectId: project.id,
        ownerId: LOCAL_OWNER.id,
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

    const [frameSequenceAsset] = await db
      .insert(projectAssets)
      .values({
        projectId: project.id,
        ownerId: LOCAL_OWNER.id,
        kind: "frame_sequence",
        storageKey: `demo/${demo.slug}/sequence.json`,
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
        ownerId: LOCAL_OWNER.id,
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

    if (!sourceAsset || !frameSequenceAsset || !posterAsset) {
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
        ownerId: LOCAL_OWNER.id,
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

    const frameAssets = await db
      .insert(projectAssets)
      .values(
        demo.frameUrls.map((frameUrl, index) => ({
          projectId: project.id,
          ownerId: LOCAL_OWNER.id,
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

    await db.insert(assetVariants).values(
      frameAssets.flatMap((frameAsset) => [
        {
          assetId: frameAsset.id,
          kind: "desktop" as const,
          storageKey: frameAsset.storageKey,
          publicUrl: frameAsset.publicUrl,
          metadata: {
            kind: "desktop",
            width: demo.width ?? 1440,
            height: demo.height ?? 900,
            bytes: 0,
            format: getImageFormat(frameAsset.publicUrl),
          },
        },
        {
          assetId: frameAsset.id,
          kind: "tablet" as const,
          storageKey: frameAsset.storageKey,
          publicUrl: frameAsset.publicUrl,
          metadata: {
            kind: "tablet",
            width: Math.min(demo.width ?? 1440, 1080),
            height: Math.round(
              (Math.min(demo.width ?? 1440, 1080) * (demo.height ?? 900)) /
                Math.max(demo.width ?? 1440, 1),
            ),
            bytes: 0,
            format: getImageFormat(frameAsset.publicUrl),
          },
        },
        {
          assetId: frameAsset.id,
          kind: "mobile" as const,
          storageKey: frameAsset.storageKey,
          publicUrl: frameAsset.publicUrl,
          metadata: {
            kind: "mobile",
            width: Math.min(demo.width ?? 1440, 720),
            height: Math.round(
              (Math.min(demo.width ?? 1440, 720) * (demo.height ?? 900)) /
                Math.max(demo.width ?? 1440, 1),
            ),
            bytes: 0,
            format: getImageFormat(frameAsset.publicUrl),
          },
        },
      ]),
    );

    const payload: ProcessingJobPayload = {
      projectId: project.id,
      assetId: sourceAsset.id,
      sourceType: "video",
      sourceOrigin: "upload",
      retentionPolicy: "keep_source",
      outputTargets: demo.fallbackVideoUrl
        ? ["frames", "poster", "fallback_video", "manifest_fragment"]
        : ["frames", "poster", "manifest_fragment"],
    };

    await db.insert(processingJobs).values({
      projectId: project.id,
      assetId: sourceAsset.id,
      status: "completed",
      payload,
      outputs: {
        posterUrl: posterAsset.publicUrl,
        fallbackVideoUrl: demo.fallbackVideoUrl,
        frameVariantBasePath:
          demo.frameUrls[0]?.replace(/\/frame-\d+\.(jpg|jpeg|png|webp)$/i, "") ??
          `demo/${demo.slug}/frames`,
        frameCount: demo.frameCount ?? demo.frameUrls.length,
      },
    });

    const publishedAt = new Date();

    await db.insert(publishTargets).values([
      {
        projectId: project.id,
        targetType: "hosted_embed",
        slug: demo.slug,
        isReady: true,
        publishedAt,
      },
      {
        projectId: project.id,
        targetType: "script_embed",
        slug: `${demo.slug}-script`,
        isReady: true,
        publishedAt,
      },
    ]);

    const manifest = await buildProjectManifest(project.id);

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
        updatedAt: publishedAt,
      })
      .where(eq(publishTargets.projectId, project.id));
  }
}

async function seed() {
  await db
    .insert(users)
    .values({
      id: LOCAL_OWNER.id,
      email: LOCAL_OWNER.email,
      name: LOCAL_OWNER.name,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: LOCAL_OWNER.email,
        name: LOCAL_OWNER.name,
      },
    });

  await seedTemplates();
  await seedDemoProjects();

  const owner = await db.query.users.findFirst({
    where: eq(users.id, LOCAL_OWNER.id),
  });

  const demoProjects = await db.query.projects.findMany({
    where: eq(projects.ownerId, LOCAL_OWNER.id),
  });

  console.log(
    JSON.stringify(
      {
        owner,
        templatesSeeded: presetDefinitions.length,
        demoProjectsSeeded: demoProjects.filter((project) => project.slug.startsWith("demo-"))
          .length,
      },
      null,
      2,
    ),
  );
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
