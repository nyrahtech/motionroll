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

type FrameVariantRow = {
  kind: string;
  publicUrl: string;
  metadata: unknown;
};

type AssetRow = {
  kind: string;
  storageKey: string;
  publicUrl: string;
  metadata: unknown;
  variants: FrameVariantRow[];
};

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
  fromKey: string;
  toKey: string;
  preset: "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve";
  easing: "linear" | "ease-out" | "ease-in-out" | "back-out" | "expo-out";
  durationMs: number;
};

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
            url: variant.publicUrl,
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
  const frameAssets = normalizeFrameAssets(input.assets);
  const posterAsset = input.assets.find((asset) => asset.kind === "poster");
  const fallbackVideoAsset = input.assets.find((asset) => asset.kind === "fallback_video");
  const frameSequenceAsset = input.assets.find((asset) => asset.kind === "frame_sequence");
  const sequenceFrameCount =
    (frameSequenceAsset?.metadata as { frameCount?: number } | undefined)?.frameCount ?? 0;
  const frameCount =
    Math.max(frameAssets.length, sequenceFrameCount) || input.section.commonConfig.frameRange.end + 1;
  const normalizedRange = normalizeFrameRange(input.section.commonConfig.frameRange, frameCount);
  const overlays = normalizeOverlayRows(input.overlays);

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
      posterUrl: posterAsset?.publicUrl,
      fallbackVideoUrl: fallbackVideoAsset?.publicUrl,
    }),
    motion: {
      sectionHeightVh: input.section.commonConfig.sectionHeightVh,
      scrubStrength: input.section.commonConfig.scrubStrength,
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
