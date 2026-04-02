import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, publishTargets, publishVersions } from "@/db/schema";
import { buildProjectManifest } from "@/lib/manifest";
import {
  collectReferencedMediaAssetIds,
  getDerivedAssetsSnapshot,
  rewriteManifestMediaUrls,
} from "@/lib/project-assets";
import { copyStorageObject, getStoragePublicUrl } from "@/lib/storage/s3-adapter";

type VariantRow = {
  kind: string;
  storageKey: string;
  publicUrl: string;
  metadata: unknown;
};

type AssetRow = {
  id: string;
  kind: string;
  storageKey: string;
  publicUrl: string;
  metadata: unknown;
  variants: VariantRow[];
};

function usesStaticPublicAsset(asset: { publicUrl: string }) {
  return asset.publicUrl.startsWith("/");
}

function resolveExtension(input: { key: string; metadata: unknown; fallback: string }) {
  const keyExtension = path.extname(input.key);
  if (keyExtension) {
    return keyExtension;
  }

  const metadata = input.metadata as { format?: string; mimeType?: string };
  if (metadata.format) {
    return `.${metadata.format}`;
  }

  if (metadata.mimeType === "image/jpeg") {
    return ".jpg";
  }

  if (metadata.mimeType === "video/mp4") {
    return ".mp4";
  }

  return input.fallback;
}

async function cloneDerivedAssetsForPublish(
  projectId: string,
  nextVersion: number,
  assets: AssetRow[],
) {
  const draftAssets = getDerivedAssetsSnapshot(assets);
  const publishBasePath = `publishes/${projectId}/v${nextVersion}`;

  const publishedAssets = await Promise.all(
    draftAssets.map(async (asset) => {
      if (usesStaticPublicAsset(asset)) {
        return asset;
      }

      if (asset.kind === "frame_sequence") {
        return {
          ...asset,
          storageKey: `${publishBasePath}/frames`,
          publicUrl: getStoragePublicUrl(`${publishBasePath}/frames`),
        };
      }

      if (asset.kind === "frame") {
        const metadata = asset.metadata as { frameIndex?: number };
        const frameIndex = metadata.frameIndex ?? 0;
        const frameBasePath = `${publishBasePath}/frames/frame-${String(frameIndex).padStart(5, "0")}`;
        const variants = await Promise.all(
          asset.variants.map(async (variant) => {
            if (usesStaticPublicAsset(variant)) {
              return variant;
            }

            const destinationKey = `${frameBasePath}/${variant.kind}${resolveExtension({
              key: variant.storageKey,
              metadata: variant.metadata,
              fallback: ".jpg",
            })}`;
            const copied = await copyStorageObject(variant.storageKey, destinationKey);
            return {
              ...variant,
              storageKey: copied.key,
              publicUrl: copied.publicUrl,
            };
          }),
        );

        return {
          ...asset,
          storageKey: frameBasePath,
          publicUrl: variants[0]?.publicUrl ?? asset.publicUrl,
          variants,
        };
      }

      const destinationKey = `${publishBasePath}/${asset.kind}${resolveExtension({
        key: asset.storageKey,
        metadata: asset.metadata,
        fallback: asset.kind === "fallback_video" ? ".mp4" : ".jpg",
      })}`;
      const copied = await copyStorageObject(asset.storageKey, destinationKey);

      return {
        ...asset,
        storageKey: copied.key,
        publicUrl: copied.publicUrl,
      };
    }),
  );

  return {
    publishBasePath,
    publishedAssets,
  };
}

async function cloneReferencedMediaAssetsForPublish(
  publishBasePath: string,
  assets: AssetRow[],
  assetIds: string[],
) {
  const urlByAssetId = new Map<string, string>();

  await Promise.all(
    assetIds.map(async (assetId) => {
      const asset = assets.find((candidate) => candidate.id === assetId);
      if (!asset || usesStaticPublicAsset(asset)) {
        return;
      }

      const destinationKey = `${publishBasePath}/media/${asset.id}${resolveExtension({
        key: asset.storageKey,
        metadata: asset.metadata,
        fallback: ".mp4",
      })}`;
      const copied = await copyStorageObject(asset.storageKey, destinationKey);
      urlByAssetId.set(asset.id, copied.publicUrl);
    }),
  );

  return urlByAssetId;
}

export async function createPublishedSnapshot(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
    with: {
      assets: {
        with: {
          variants: true,
        },
      },
      publishTargets: true,
    },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  const nextVersion = project.latestPublishVersion + 1;
  const publishedAt = new Date();
  const { publishBasePath, publishedAssets } = await cloneDerivedAssetsForPublish(
    projectId,
    nextVersion,
    project.assets as AssetRow[],
  );
  const manifest = await buildProjectManifest(projectId, {
    userId,
    publishVersion: nextVersion,
    persistDraftManifest: true,
    publishedAt,
    publishTargetReady: true,
    assetsOverride: publishedAssets,
  });
  const rewrittenManifest = rewriteManifestMediaUrls(
    manifest,
    await cloneReferencedMediaAssetsForPublish(
      publishBasePath,
      project.assets as AssetRow[],
      collectReferencedMediaAssetIds(manifest),
    ),
  );

  const [snapshot] = await db
    .insert(publishVersions)
    .values({
      projectId,
      version: nextVersion,
      assetBasePath: publishBasePath,
      manifest: rewrittenManifest,
      publishedAt,
    })
    .returning();

  await db
    .update(projects)
    .set({
      status: "published",
      publishVersion: nextVersion,
      latestPublishVersion: nextVersion,
      latestPublishId: snapshot?.id ?? null,
      lastPublishedAt: publishedAt,
      updatedAt: publishedAt,
    })
    .where(eq(projects.id, projectId));

  await db
    .update(publishTargets)
    .set({
      isReady: true,
      version: nextVersion,
      publishedAt,
      updatedAt: publishedAt,
    })
    .where(eq(publishTargets.projectId, projectId));

  return {
    manifest: {
      ...rewrittenManifest,
      publishTarget: {
        ...rewrittenManifest.publishTarget,
        publishedVersionId: snapshot?.id,
      },
    },
    snapshot,
  };
}
