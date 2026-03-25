import { resolveStorageReadUrl } from "./storage/public-urls";

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
  template?: {
    thumbnailUrl?: string | null;
  } | null;
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
  if (asset.publicUrl && ["poster", "frame", "thumbnail"].includes(asset.kind)) {
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

export function getProjectCoverUrl(project: CoverProjectLike) {
  const thumbnail = sortProjectAssets(project.assets).find((asset) => asset.kind === "thumbnail");
  if (thumbnail?.publicUrl) {
    return resolveStorageReadUrl(thumbnail.publicUrl, thumbnail.storageKey);
  }

  const poster = sortProjectAssets(project.assets).find((asset) => asset.kind === "poster");
  if (poster?.publicUrl) {
    return resolveStorageReadUrl(poster.publicUrl, poster.storageKey);
  }

  if (project.template?.thumbnailUrl) {
    return project.template.thumbnailUrl;
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
