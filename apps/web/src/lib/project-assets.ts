type VariantLike = {
  kind: string;
  publicUrl: string;
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
  createdAt?: Date;
  updatedAt?: Date;
  variants?: VariantLike[];
};

const derivedAssetKinds = new Set(["frame_sequence", "frame", "poster", "fallback_video", "thumbnail"]);

function assetTimeValue(asset: AssetLike) {
  return asset.updatedAt?.getTime() ?? asset.createdAt?.getTime() ?? 0;
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
    return asset.publicUrl;
  }

  const poster = assets.find((candidate) => candidate.kind === "poster");
  if (poster?.publicUrl) {
    return poster.publicUrl;
  }

  const firstFrame = sortProjectAssets(assets).find((candidate) => candidate.kind === "frame");
  if (firstFrame?.publicUrl) {
    return firstFrame.publicUrl;
  }

  if (asset.kind === "fallback_video" && asset.publicUrl) {
    return asset.publicUrl;
  }

  return "";
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
