import {
  type FallbackConfig,
  type OverlayDefinition,
  type ProjectSectionManifest,
  ProjectManifestSchema,
  type PublishTargetSummary,
  getPresetFallbackPolicy,
  getPresetRuntimeProfile,
  resolveFallbackStrategy,
} from "@motionroll/shared";
import { resolveStorageReadUrl } from "./storage/public-urls";
import motionrollDemoMetadata from "../../public/motionroll_demo_sequence/metadata.json";

type FrameVariantRow = {
  kind: string;
  publicUrl: string;
  storageKey?: string;
  metadata: unknown;
};

type AssetRow = {
  kind: string;
  storageKey: string;
  publicUrl: string;
  metadata: unknown;
  variants: FrameVariantRow[];
};

const BUNDLED_FRAME_PACKS = [
  {
    match: "motionroll_demo_sequence",
    frameBaseUrl: motionrollDemoMetadata.frameBaseUrl,
    framePattern: motionrollDemoMetadata.framePattern,
    frameCount: motionrollDemoMetadata.frameCount,
    width: motionrollDemoMetadata.width,
    height: motionrollDemoMetadata.height,
  },
] as const;

type OverlayRow = {
  overlayKey: string;
  timing: { start: number; end: number };
  content: OverlayDefinition["content"];
};

type MomentRow = {
  momentKey: string;
  label: string;
  description?: string | null;
  timing: { start: number; end: number };
};

type TransitionRow = {
  id: string;
  scope: "sequence" | "moment";
  phase?: "enter" | "exit";
  fromKey: string;
  toKey: string;
  preset: "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve";
  easing: "linear" | "ease-out" | "ease-in-out" | "back-out" | "expo-out";
  durationMs: number;
};

function getSectionDurationSecondsFromAssets(input: {
  assets: AssetRow[];
  frameCount: number;
  sequenceFrameCount: number;
}) {
  const sourceAsset = input.assets.find((asset) => asset.kind === "source_video");
  const sourceDurationMs = (sourceAsset?.metadata as { durationMs?: number } | undefined)?.durationMs;
  if (typeof sourceDurationMs === "number" && sourceDurationMs > 0) {
    return sourceDurationMs / 1000;
  }

  const frameSequenceAsset = input.assets.find((asset) => asset.kind === "frame_sequence");
  const sequenceMetadata = (frameSequenceAsset?.metadata as { durationMs?: number; fps?: number } | undefined) ?? {};
  if (typeof sequenceMetadata.durationMs === "number" && sequenceMetadata.durationMs > 0) {
    return sequenceMetadata.durationMs / 1000;
  }
  if (typeof sequenceMetadata.fps === "number" && sequenceMetadata.fps > 0 && input.sequenceFrameCount > 0) {
    return input.sequenceFrameCount / sequenceMetadata.fps;
  }

  const fallbackVideoAsset = input.assets.find((asset) => asset.kind === "fallback_video");
  const fallbackDurationMs = (fallbackVideoAsset?.metadata as { durationMs?: number } | undefined)?.durationMs;
  if (typeof fallbackDurationMs === "number" && fallbackDurationMs > 0) {
    return fallbackDurationMs / 1000;
  }

  return Math.max(input.frameCount / 24, 0.1);
}

export function normalizeFrameAssets(assets: AssetRow[]) {
  const seenIndexes = new Set<number>();

  return assets
    .filter((asset) => asset.kind === "frame")
    .map((asset) => {
      const metadata = asset.metadata as { frameIndex?: number };
      return {
        index: metadata.frameIndex ?? 0,
        path: asset.storageKey,
        variants: asset.variants
          .map((variant) => ({
            kind: variant.kind as
              | "desktop"
              | "tablet"
              | "mobile"
              | "original"
              | "poster"
              | "fallback_video",
            url: resolveStorageReadUrl(variant.publicUrl, variant.storageKey),
            width: (variant.metadata as { width?: number }).width,
            height: (variant.metadata as { height?: number }).height,
          }))
          .filter((variant) => variant.url.length > 0),
      };
    })
    .filter((frame) => {
      if (seenIndexes.has(frame.index) || frame.variants.length === 0) {
        return false;
      }
      seenIndexes.add(frame.index);
      return true;
    })
    .sort((a, b) => a.index - b.index);
}

function getBundledFramePack(assets: AssetRow[]) {
  return BUNDLED_FRAME_PACKS.find((pack) =>
    assets.some((asset) => asset.storageKey.includes(pack.match) || asset.publicUrl.includes(pack.match)),
  );
}

function buildBundledFrameAssets(
  pack: (typeof BUNDLED_FRAME_PACKS)[number],
  frameCount: number,
) {
  const normalizedCount = Math.max(Math.min(frameCount, pack.frameCount), 0);
  const extensionMatch = pack.framePattern.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch?.[1] ?? "webp";

  return Array.from({ length: normalizedCount }, (_, index) => {
    const filename = `frame-${String(index + 1).padStart(4, "0")}.${extension}`;
    const url = `${pack.frameBaseUrl}/${filename}`;
    return {
      index,
      path: `${pack.match}/frames/${filename}`,
      variants: [
        {
          kind: "desktop" as const,
          url,
          width: pack.width,
          height: pack.height,
        },
      ],
    };
  });
}

export function normalizeFrameRange(
  frameRange: { start: number; end: number },
  frameCount: number,
) {
  if (frameCount < 2) {
    return {
      start: Math.max(frameRange.start, 0),
      end: Math.max(frameRange.end, frameRange.start + 1),
    };
  }

  const maxIndex = frameCount - 1;
  const start = Math.min(Math.max(frameRange.start, 0), maxIndex - 1);
  const end = Math.min(Math.max(frameRange.end, start + 1), maxIndex);
  return { start, end };
}

export function normalizeOverlayRows(overlays: OverlayRow[]) {
  return [...overlays]
    .map((overlay, index) => ({
      ...overlay,
      sourceIndex: index,
      content: {
        ...overlay.content,
        treatment: overlay.content.treatment ?? "default",
        layer: Math.max(0, overlay.content.layer ?? 0),
      },
      timing: {
        start: Math.min(Math.max(overlay.timing.start, 0), 1),
        end: Math.min(Math.max(overlay.timing.end, 0), 1),
      },
    }))
    .sort((left, right) =>
      (left.content.layer ?? 0) - (right.content.layer ?? 0) || left.sourceIndex - right.sourceIndex,
    )
    .map((overlay) => ({
      ...overlay,
      timing: {
        start: Math.min(overlay.timing.start, overlay.timing.end),
        end: Math.max(overlay.timing.end, overlay.timing.start),
      },
    }))
    .map(({ sourceIndex: _sourceIndex, ...overlay }) => overlay);
}

function pickFrameVariantUrl(
  frameAssets: Array<ReturnType<typeof normalizeFrameAssets>[number]>,
  preferredIndex = 0,
) {
  const frame = frameAssets[preferredIndex] ?? frameAssets[0];
  if (!frame) {
    return undefined;
  }

  return (
    frame.variants.find((variant) => variant.kind === "desktop")?.url ??
    frame.variants.find((variant) => variant.kind === "tablet")?.url ??
    frame.variants.find((variant) => variant.kind === "mobile")?.url ??
    frame.variants.find((variant) => variant.kind === "original")?.url ??
    frame.variants[0]?.url
  );
}

export function resolveManifestFallback(input: {
  presetId: ProjectSectionManifest["presetId"];
  requestedMobileBehavior: FallbackConfig["mobileBehavior"];
  requestedReducedMotionBehavior: FallbackConfig["reducedMotionBehavior"];
  frameAssets: Array<ReturnType<typeof normalizeFrameAssets>[number]>;
  posterUrl?: string;
  fallbackVideoUrl?: string;
}): FallbackConfig {
  const policy = getPresetFallbackPolicy(input.presetId);
  const firstFrameUrl = pickFrameVariantUrl(input.frameAssets);
  const hasFrames = input.frameAssets.length > 0;
  const hasPoster = Boolean(input.posterUrl);
  const hasFallbackVideo = Boolean(input.fallbackVideoUrl);

  const resolvedMobileStrategy = resolveFallbackStrategy({
    requestedBehavior: input.requestedMobileBehavior,
    hasFrames,
    hasPoster,
    hasFallbackVideo,
    allowFirstFrameFallback: policy.allowFirstFrameFallback,
  });
  const resolvedReducedMotionStrategy = resolveFallbackStrategy({
    requestedBehavior: input.requestedReducedMotionBehavior,
    hasFrames,
    hasPoster,
    hasFallbackVideo,
    allowFirstFrameFallback: policy.allowFirstFrameFallback,
  });

  return {
    posterUrl: input.posterUrl,
    fallbackVideoUrl: input.fallbackVideoUrl,
    firstFrameUrl,
    mobileBehavior:
      resolvedMobileStrategy === "sequence"
        ? "sequence"
        : resolvedMobileStrategy === "video"
          ? "video"
          : "poster",
    reducedMotionBehavior:
      resolvedReducedMotionStrategy === "sequence"
        ? "sequence"
        : resolvedReducedMotionStrategy === "video"
          ? "video"
          : "poster",
  };
}

export function buildSectionManifest(input: {
  section: {
    id: string;
    presetId:
      | "scroll-sequence"
      | "product-reveal"
      | "feature-walkthrough"
      | "before-after"
      | "device-spin"
      | "chaptered-scroll-story";
    title: string;
    commonConfig: {
      sectionHeightVh: number;
      scrubStrength: number;
      frameRange: { start: number; end: number };
      fallbackBehavior: {
        mobile: "poster" | "video" | "sequence";
        reducedMotion: "poster" | "video" | "sequence";
      };
      motion: {
        easing: "linear" | "power2.out" | "power3.out";
        pin: boolean;
        preloadWindow: number;
      };
    };
    presetConfig: Record<string, string | number | boolean | string[]>;
  };
  overlays: OverlayRow[];
  moments?: MomentRow[];
  transitions?: TransitionRow[];
  assets: AssetRow[];
}): ProjectSectionManifest {
  const bundledFramePack = getBundledFramePack(input.assets);
  const bundledFramePackLimit = bundledFramePack?.frameCount;
  const normalizedFrameAssets = normalizeFrameAssets(input.assets).filter((frame) =>
    typeof bundledFramePackLimit === "number" ? frame.index < bundledFramePackLimit : true,
  );
  const posterAsset = input.assets.find((asset) => asset.kind === "poster");
  const fallbackVideoAsset = input.assets.find((asset) => asset.kind === "fallback_video");
  const posterUrl = resolveStorageReadUrl(posterAsset?.publicUrl, posterAsset?.storageKey);
  const fallbackVideoUrl = resolveStorageReadUrl(
    fallbackVideoAsset?.publicUrl,
    fallbackVideoAsset?.storageKey,
  );
  const frameSequenceAsset = input.assets.find((asset) => asset.kind === "frame_sequence");
  const rawSequenceFrameCount =
    (frameSequenceAsset?.metadata as { frameCount?: number } | undefined)?.frameCount ?? 0;
  const sequenceFrameCount =
    typeof bundledFramePackLimit === "number" && rawSequenceFrameCount > 0
      ? Math.min(rawSequenceFrameCount, bundledFramePackLimit)
      : rawSequenceFrameCount;
  const frameAssets =
    normalizedFrameAssets.length > 0
      ? normalizedFrameAssets
      : bundledFramePack && sequenceFrameCount > 0
        ? buildBundledFrameAssets(bundledFramePack, sequenceFrameCount)
        : normalizedFrameAssets;
  const frameCount =
    Math.max(frameAssets.length, sequenceFrameCount) || input.section.commonConfig.frameRange.end + 1;
  const normalizedRange = normalizeFrameRange(input.section.commonConfig.frameRange, frameCount);
  const overlays = normalizeOverlayRows(input.overlays);
  const durationSeconds = getSectionDurationSecondsFromAssets({
    assets: input.assets,
    frameCount,
    sequenceFrameCount,
  });

  return {
    id: input.section.id,
    presetId: input.section.presetId,
    title: input.section.title,
    frameAssets,
    frameCount,
    progressMapping: {
      startProgress: 0,
      endProgress: 1,
      frameCount,
      frameRange: normalizedRange,
    },
    overlays: overlays.map((overlay) => ({
      id: overlay.overlayKey,
      timing: overlay.timing,
      timingSource: "sceneRange",
      content: overlay.content,
    })),
    moments: (input.moments ?? []).map((moment) => ({
      id: moment.momentKey,
      label: moment.label,
      description: moment.description ?? undefined,
      timing: moment.timing,
    })),
    transitions: (input.transitions ?? []).map((transition) => ({
      id: transition.id,
      scope: transition.scope,
      phase: transition.phase ?? "enter",
      fromId: transition.fromKey,
      toId: transition.toKey,
      preset: transition.preset,
      easing: transition.easing,
      duration: transition.durationMs / 1000,
    })),
    fallback: resolveManifestFallback({
      presetId: input.section.presetId,
      requestedMobileBehavior: input.section.commonConfig.fallbackBehavior.mobile,
      requestedReducedMotionBehavior: input.section.commonConfig.fallbackBehavior.reducedMotion,
      frameAssets,
      posterUrl: posterUrl || undefined,
      fallbackVideoUrl: fallbackVideoUrl || undefined,
    }),
    motion: {
      sectionHeightVh: input.section.commonConfig.sectionHeightVh,
      scrubStrength: input.section.commonConfig.scrubStrength,
      durationSeconds,
      easing: input.section.commonConfig.motion.easing,
      pin: input.section.commonConfig.motion.pin,
      preloadWindow: input.section.commonConfig.motion.preloadWindow,
    },
    presetConfig: input.section.presetConfig,
    runtimeProfile: getPresetRuntimeProfile(input.section.presetId),
  };
}

export function validateProjectManifest(manifest: unknown) {
  return ProjectManifestSchema.parse(manifest);
}

export function buildPublishTargetSummary(input: PublishTargetSummary) {
  return input;
}
