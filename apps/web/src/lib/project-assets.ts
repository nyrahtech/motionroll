import { resolveStorageReadUrl } from "./storage/public-urls";
import type { BackgroundMedia, OverlayMediaMetadata, ProjectManifest } from "@motionroll/shared";

type VariantLike = {
  kind: string;
  publicUrl: string;
  storageKey?: string;
  metadata?: unknown;
};

type AssetLike = {
  id?: string;
  projectId?: string;
  kind: string;
  isPrimary?: boolean;
  sourceType?: string | null;
  sourceOrigin?: string | null;
  storageKey?: string;
  publicUrl: string;
  metadata?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  variants?: VariantLike[];
};

type CoverProjectLike = {
  assets: AssetLike[];
  selectedPreset?: string;
};

const presetThumbnailMap: Record<string, string> = {
  "product-reveal": "/thumbnails/product-reveal.png",
  "scroll-sequence": "/thumbnails/scroll-sequence.png",
  "feature-walkthrough": "/thumbnails/feature-walkthrough.png",
  "device-spin": "/thumbnails/device-spin.png",
  "before-after": "/thumbnails/before-after.png",
  "chaptered-scroll-story": "/thumbnails/chaptered-scroll-story.png",
};

const derivedAssetKinds = new Set(["frame_sequence", "frame", "poster", "fallback_video", "thumbnail"]);

function toTimeValue(value?: Date | string) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function assetTimeValue(asset: AssetLike) {
  return toTimeValue(asset.updatedAt) || toTimeValue(asset.createdAt) || 0;
}

export function sortProjectAssets<T extends AssetLike>(assets: T[]) {
  return [...assets].sort((left, right) => {
    const timeDelta = assetTimeValue(right) - assetTimeValue(left);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return (left.storageKey ?? left.publicUrl).localeCompare(
      right.storageKey ?? right.publicUrl,
    );
  });
}

export function getPrimarySourceAsset<T extends AssetLike>(assets: T[]) {
  return [...assets]
    .filter((asset) => asset.kind === "source_video")
    .sort((left, right) => {
      const primaryDelta =
        Number(Boolean(right.isPrimary)) - Number(Boolean(left.isPrimary));
      if (primaryDelta !== 0) {
        return primaryDelta;
      }

      const timeDelta = assetTimeValue(right) - assetTimeValue(left);
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return (left.storageKey ?? left.publicUrl).localeCompare(
        right.storageKey ?? right.publicUrl,
      );
    })[0];
}

export function getDerivedAssetsSnapshot<T extends AssetLike>(assets: T[]) {
  return sortProjectAssets(assets).filter((asset) => derivedAssetKinds.has(asset.kind));
}

export function getRenderableAssetPreview(
  asset: AssetLike,
  assets: AssetLike[],
) {
  if (asset.publicUrl && ["poster", "frame", "thumbnail", "media_video"].includes(asset.kind)) {
    return resolveStorageReadUrl(asset.publicUrl, asset.storageKey);
  }

  const poster = assets.find((candidate) => candidate.kind === "poster");
  if (poster?.publicUrl) {
    return resolveStorageReadUrl(poster.publicUrl, poster.storageKey);
  }

  const firstFrame = sortProjectAssets(assets).find((candidate) => candidate.kind === "frame");
  if (firstFrame?.publicUrl) {
    return resolveStorageReadUrl(firstFrame.publicUrl, firstFrame.storageKey);
  }

  if (asset.kind === "fallback_video" && asset.publicUrl) {
    return resolveStorageReadUrl(asset.publicUrl, asset.storageKey);
  }

  return "";
}

export function getOverlayMediaMetadataFromAsset(asset: AssetLike): OverlayMediaMetadata {
  const metadata = (asset.metadata ?? {}) as { mimeType?: string; contentType?: string; kind?: string };
  return {
    kind: metadata.kind === "image" || metadata.kind === "video"
      ? metadata.kind
      : metadata.mimeType?.startsWith("video/") || metadata.contentType?.startsWith("video/")
        ? "video"
        : metadata.mimeType?.startsWith("image/") || metadata.contentType?.startsWith("image/")
          ? "image"
          : undefined,
    mimeType: metadata.mimeType,
    contentType: metadata.contentType,
  };
}

export function buildBackgroundMediaFromAsset(asset: AssetLike): BackgroundMedia {
  const metadata = (asset.metadata ?? {}) as {
    width?: number;
    height?: number;
    durationMs?: number;
    mimeType?: string;
    contentType?: string;
    kind?: string;
  };
  return {
    assetId: asset.id,
    url: resolveStorageReadUrl(asset.publicUrl, asset.storageKey),
    previewUrl: resolveStorageReadUrl(asset.publicUrl, asset.storageKey),
    metadata: {
      ...getOverlayMediaMetadataFromAsset(asset),
      kind: "video",
      width: metadata.width,
      height: metadata.height,
      durationMs: metadata.durationMs,
    },
  };
}

export function collectReferencedMediaAssetIds(
  manifest: Pick<ProjectManifest, "sections" | "canvas" | "layers">,
) {
  const assetIds = new Set<string>();

  if (manifest.canvas.backgroundTrack?.media.assetId) {
    assetIds.add(manifest.canvas.backgroundTrack.media.assetId);
  }

  for (const layer of manifest.layers) {
    if (layer.content.mediaAssetId) {
      assetIds.add(layer.content.mediaAssetId);
    }
  }

  for (const section of manifest.sections) {
    if (section.backgroundMedia?.assetId) {
      assetIds.add(section.backgroundMedia.assetId);
    }
    for (const overlay of section.overlays) {
      if (overlay.content.mediaAssetId) {
        assetIds.add(overlay.content.mediaAssetId);
      }
    }
  }

  return Array.from(assetIds);
}

export function rewriteManifestMediaUrls(
  manifest: ProjectManifest,
  urlByAssetId: Map<string, string>,
) {
  return {
    ...manifest,
    canvas:
      manifest.canvas.backgroundTrack?.media.assetId &&
      urlByAssetId.has(manifest.canvas.backgroundTrack.media.assetId)
        ? {
            ...manifest.canvas,
            backgroundTrack: {
              ...manifest.canvas.backgroundTrack,
              media: {
                ...manifest.canvas.backgroundTrack.media,
                url: urlByAssetId.get(manifest.canvas.backgroundTrack.media.assetId)!,
                previewUrl: urlByAssetId.get(manifest.canvas.backgroundTrack.media.assetId)!,
              },
            },
          }
        : manifest.canvas,
    layers: manifest.layers.map((layer) => ({
      ...layer,
      content:
        layer.content.mediaAssetId && urlByAssetId.has(layer.content.mediaAssetId)
          ? {
              ...layer.content,
              mediaUrl: urlByAssetId.get(layer.content.mediaAssetId)!,
              mediaPreviewUrl: urlByAssetId.get(layer.content.mediaAssetId)!,
            }
          : layer.content,
    })),
    sections: manifest.sections.map((section) => ({
      ...section,
      backgroundMedia:
        section.backgroundMedia?.assetId && urlByAssetId.has(section.backgroundMedia.assetId)
          ? {
              ...section.backgroundMedia,
              url: urlByAssetId.get(section.backgroundMedia.assetId)!,
              previewUrl: urlByAssetId.get(section.backgroundMedia.assetId)!,
            }
          : section.backgroundMedia,
      overlays: section.overlays.map((overlay) => ({
        ...overlay,
        content:
          overlay.content.mediaAssetId && urlByAssetId.has(overlay.content.mediaAssetId)
            ? {
                ...overlay.content,
                mediaUrl: urlByAssetId.get(overlay.content.mediaAssetId)!,
                mediaPreviewUrl: urlByAssetId.get(overlay.content.mediaAssetId)!,
              }
            : overlay.content,
      })),
    })),
  };
}

export function getProjectCoverUrl(project: CoverProjectLike) {
  const thumbnail = sortProjectAssets(project.assets).find((asset) => asset.kind === "thumbnail");
  if (thumbnail?.publicUrl) {
    return resolveStorageReadUrl(thumbnail.publicUrl, thumbnail.storageKey);
  }

  const poster = sortProjectAssets(project.assets).find((asset) => asset.kind === "poster");
  if (poster?.publicUrl) {
    return resolveStorageReadUrl(poster.publicUrl, poster.storageKey);
  }

  return presetThumbnailMap[project.selectedPreset ?? ""] ?? "/thumbnails/product-reveal.png";
}

export function getSourceAssetValidationError(input: {
  asset?: AssetLike | null;
  projectId: string;
  sourceType: "video" | "ai_clip";
  sourceOrigin: "upload" | "ai_import";
  maxBytes?: number;
}) {
  const { asset, projectId, sourceType, sourceOrigin, maxBytes } = input;
  if (!asset) {
    return "Asset not found for project.";
  }

  if (asset.projectId && asset.projectId !== projectId) {
    return "Asset does not belong to the requested project.";
  }

  if (asset.kind !== "source_video") {
    return "Only video source assets can be processed.";
  }

  if (!asset.isPrimary) {
    return "Only the active primary source can be processed for this project.";
  }

  if (asset.sourceType !== sourceType || asset.sourceOrigin !== sourceOrigin) {
    return "Asset source metadata does not match the requested processing flow.";
  }

  const metadata = (asset.metadata ?? {}) as { bytes?: number };
  if (typeof maxBytes === "number" && (metadata.bytes ?? 0) > maxBytes) {
    return "Source video exceeds the configured processing size limit.";
  }

  return null;
}
