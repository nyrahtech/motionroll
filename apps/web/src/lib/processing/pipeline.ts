import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { and, eq, inArray } from "drizzle-orm";
import {
  type AssetMetadata,
  type AssetVariantMetadata,
  type ProcessingJobPayload,
  ProcessingJobPayloadSchema,
} from "@motionroll/shared";
import { db } from "@/db/client";
import { assetVariants, processingJobs, projectAssets, projects } from "@/db/schema";
import { LOCAL_OWNER } from "@/lib/data/local-owner";
import { env } from "@/lib/env";
import {
  deleteStorageObject,
  downloadStorageObject,
  getStoragePublicUrl,
  uploadBuffer,
} from "@/lib/storage/s3-adapter";
import { getSourceAssetValidationError } from "@/lib/project-assets";
import {
  ensureTempDir,
  extractVideoFrames,
  generateFallbackVideo,
  generatePoster,
} from "./ffmpeg";

const derivativeWidths = [
  { kind: "desktop", width: 1600 },
  { kind: "tablet", width: 1080 },
  { kind: "mobile", width: 720 },
] as const;

async function sha256ForFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      hash.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function uploadFrameVariants(runBasePath: string, framePaths: string[]) {
  return Promise.all(
    framePaths.map(async (framePath, index) => {
      const fileBuffer = await readFile(framePath);
      const baseImage = sharp(fileBuffer);
      const frameDirectory = `${runBasePath}/frames/${String(index).padStart(5, "0")}`;

      const uploadedVariants = await Promise.all(
        derivativeWidths.map(async (variant) => {
          const resizedBuffer = await baseImage
            .clone()
            .resize({ width: variant.width })
            .jpeg({ quality: 82, mozjpeg: true })
            .toBuffer();

          const key = `${frameDirectory}/${variant.kind}.jpg`;
          const uploaded = await uploadBuffer(key, resizedBuffer, "image/jpeg");
          const metadata = await sharp(resizedBuffer).metadata();

          return {
            key,
            publicUrl: uploaded.publicUrl,
            metadata: {
              kind: variant.kind,
              width: metadata.width,
              height: metadata.height,
              bytes: resizedBuffer.byteLength,
              format: "jpg",
            } satisfies AssetVariantMetadata,
          };
        }),
      );

      return {
        index,
        path: framePath,
        variants: uploadedVariants,
      };
    }),
  );
}

async function getExistingDerivedAssets(projectId: string) {
  return db.query.projectAssets.findMany({
    where: and(
      eq(projectAssets.projectId, projectId),
      inArray(projectAssets.kind, ["frame_sequence", "frame", "poster", "fallback_video"]),
    ),
    with: {
      variants: true,
    },
  });
}

async function deleteDerivedStorageObjects(assets: Awaited<ReturnType<typeof getExistingDerivedAssets>>) {
  for (const asset of assets) {
    for (const variant of asset.variants) {
      await deleteStorageObject(variant.storageKey).catch(() => undefined);
    }
    await deleteStorageObject(asset.storageKey).catch(() => undefined);
  }
}

export async function processSourceAsset(jobId: string, payloadInput: ProcessingJobPayload) {
  const payload = ProcessingJobPayloadSchema.parse(payloadInput);
  const job = await db.query.processingJobs.findFirst({
    where: eq(processingJobs.id, jobId),
  });
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, payload.projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
  });
  const sourceAsset = await db.query.projectAssets.findFirst({
    where: and(
      eq(projectAssets.id, payload.assetId),
      eq(projectAssets.projectId, payload.projectId),
      eq(projectAssets.ownerId, LOCAL_OWNER.id),
    ),
  });

  if (!job || !project || !sourceAsset) {
    throw new Error("Processing job, project, or source asset not found.");
  }

  if (job.projectId !== payload.projectId || job.assetId !== payload.assetId) {
    throw new Error("Processing job does not match the requested project asset.");
  }

  const sourceAssetError = getSourceAssetValidationError({
    asset: {
      ...sourceAsset,
      projectId: payload.projectId,
    },
    projectId: payload.projectId,
    sourceType: payload.sourceType,
    sourceOrigin: payload.sourceOrigin,
    maxBytes: env.UPLOAD_MAX_VIDEO_BYTES,
  });
  if (sourceAssetError) {
    throw new Error(sourceAssetError);
  }

  const sourceMetadata = sourceAsset.metadata as { originalFilename?: string; bytes?: number };

  await db
    .update(processingJobs)
    .set({
      status: "running",
      updatedAt: new Date(),
    })
    .where(eq(processingJobs.id, jobId));

  await db
    .update(projects)
    .set({
      status: "processing",
      failureReason: null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, payload.projectId));

  const workDir = await ensureTempDir(payload.projectId, payload.assetId);
  const sourceLocalPath = path.join(workDir, sourceMetadata.originalFilename ?? "source.bin");
  const uploadedStorageKeys: string[] = [];

  try {
    await downloadStorageObject(sourceAsset.storageKey, sourceLocalPath);

    const frameDir = path.join(workDir, "frames");
    await mkdir(frameDir, { recursive: true });

    const framePaths = await extractVideoFrames(sourceLocalPath, frameDir);

    if (framePaths.length === 0) {
      throw new Error("No frames were generated from the source media.");
    }

    if (framePaths.length > env.PROCESSING_MAX_FRAMES) {
      throw new Error(
        `Generated ${framePaths.length} frames, which exceeds the configured limit of ${env.PROCESSING_MAX_FRAMES}.`,
      );
    }

    const posterLocalPath = path.join(workDir, "poster.jpg");
    await generatePoster(sourceLocalPath, posterLocalPath);

    const fallbackLocalPath = path.join(workDir, "fallback.mp4");
    if (framePaths.length > 1) {
      await generateFallbackVideo(sourceLocalPath, fallbackLocalPath);
    }

    const runBasePath = `${payload.projectId}/derived/runs/${jobId}`;
    const existingDerivedAssets = await getExistingDerivedAssets(payload.projectId);
    const frameVariantGroups = await uploadFrameVariants(runBasePath, framePaths);
    uploadedStorageKeys.push(
      ...frameVariantGroups.flatMap((group) => group.variants.map((variant) => variant.key)),
    );

    const posterBuffer = await readFile(posterLocalPath);
    const posterUpload = await uploadBuffer(`${runBasePath}/poster.jpg`, posterBuffer, "image/jpeg");
    uploadedStorageKeys.push(posterUpload.key);

    let fallbackUpload:
      | {
          key: string;
          publicUrl: string;
        }
      | undefined;
    if (framePaths.length > 1) {
      const fallbackBuffer = await readFile(fallbackLocalPath);
      fallbackUpload = await uploadBuffer(`${runBasePath}/fallback.mp4`, fallbackBuffer, "video/mp4");
      uploadedStorageKeys.push(fallbackUpload.key);
    }

    const sequenceAssetMeta: AssetMetadata = {
      mimeType: "application/json",
      bytes: 0,
      frameCount: framePaths.length,
      originalFilename: sourceMetadata.originalFilename,
    };

    let sequenceAssetId = "";

    await db.transaction(async (tx) => {
      if (existingDerivedAssets.length > 0) {
        await tx
          .delete(projectAssets)
          .where(inArray(projectAssets.id, existingDerivedAssets.map((asset) => asset.id)));
      }

      const [sequenceAsset] = await tx
        .insert(projectAssets)
        .values({
          projectId: payload.projectId,
          ownerId: sourceAsset.ownerId,
          kind: "frame_sequence",
          storageKey: `${runBasePath}/frames`,
          publicUrl: getStoragePublicUrl(`${runBasePath}/frames`),
          metadata: sequenceAssetMeta,
        })
        .returning();

      if (!sequenceAsset) {
        throw new Error("Failed to persist frame sequence asset.");
      }

      sequenceAssetId = sequenceAsset.id;

      for (const frameVariant of frameVariantGroups) {
        const frameSourceStats = await stat(frameVariant.path);
        const [frameAsset] = await tx
          .insert(projectAssets)
          .values({
            projectId: payload.projectId,
            ownerId: sourceAsset.ownerId,
            kind: "frame",
            storageKey: `${runBasePath}/frame-${String(frameVariant.index).padStart(5, "0")}`,
            publicUrl: frameVariant.variants[0]?.publicUrl ?? "",
            metadata: {
              mimeType: "image/jpeg",
              bytes: frameSourceStats.size,
              frameIndex: frameVariant.index,
              sha256: await sha256ForFile(frameVariant.path),
            },
          })
          .returning();

        if (!frameAsset) {
          throw new Error("Failed to persist frame asset.");
        }

        await tx.insert(assetVariants).values(
          frameVariant.variants.map((variant) => ({
            assetId: frameAsset.id,
            kind: variant.metadata.kind,
            storageKey: variant.key,
            publicUrl: variant.publicUrl,
            metadata: variant.metadata,
          })),
        );
      }

      await tx.insert(projectAssets).values({
        projectId: payload.projectId,
        ownerId: sourceAsset.ownerId,
        kind: "poster",
        storageKey: posterUpload.key,
        publicUrl: posterUpload.publicUrl,
        metadata: {
          mimeType: "image/jpeg",
          bytes: posterBuffer.byteLength,
          sha256: await sha256ForFile(posterLocalPath),
        },
      });

      if (fallbackUpload) {
        const fallbackBuffer = await readFile(fallbackLocalPath);
        await tx.insert(projectAssets).values({
          projectId: payload.projectId,
          ownerId: sourceAsset.ownerId,
          kind: "fallback_video",
          storageKey: fallbackUpload.key,
          publicUrl: fallbackUpload.publicUrl,
          metadata: {
            mimeType: "video/mp4",
            bytes: fallbackBuffer.byteLength,
          },
        });
      }

      await tx
        .update(processingJobs)
        .set({
          status: "completed",
          outputs: {
            posterUrl: posterUpload.publicUrl,
            fallbackVideoUrl: fallbackUpload?.publicUrl,
            frameVariantBasePath: `${runBasePath}/frames`,
            frameCount: framePaths.length,
          },
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId));

      await tx
        .update(projects)
        .set({
          status: "ready",
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, payload.projectId));
    });

    await deleteDerivedStorageObjects(existingDerivedAssets);

    if (payload.retentionPolicy === "delete_after_success") {
      try {
        await deleteStorageObject(sourceAsset.storageKey);
        await db
          .update(projectAssets)
          .set({
            metadata: {
              ...(sourceAsset.metadata as Record<string, unknown>),
              retainedSource: false,
              sourceDeletedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(projectAssets.id, sourceAsset.id));
      } catch (error) {
        await db
          .update(projectAssets)
          .set({
            metadata: {
              ...(sourceAsset.metadata as Record<string, unknown>),
              retainedSource: true,
              retentionError: error instanceof Error ? error.message : "Source deletion failed.",
            },
            updatedAt: new Date(),
          })
          .where(eq(projectAssets.id, sourceAsset.id));
      }
    } else {
      await db
        .update(projectAssets)
        .set({
          metadata: {
            ...(sourceAsset.metadata as Record<string, unknown>),
            retainedSource: true,
          },
          updatedAt: new Date(),
        })
        .where(eq(projectAssets.id, sourceAsset.id));
    }

    return {
      sequenceAssetId,
      frameCount: framePaths.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";

    for (const key of uploadedStorageKeys) {
      await deleteStorageObject(key).catch(() => undefined);
    }

    await db
      .update(processingJobs)
      .set({
        status: "failed",
        outputs: {
          error: message,
        },
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, jobId));

    await db
      .update(projects)
      .set({
        status: "failed",
        failureReason: message,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, payload.projectId));

    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
