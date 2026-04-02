import { z } from "zod";
import { FrameAssetSchema } from "./assets";
import { OverlayDefinitionSchema, OverlayMediaMetadataSchema } from "./overlays";
import { PresetIdSchema, PresetSpecificConfigSchema } from "./presets";
import { PresetRuntimeProfileSchema } from "./preset-runtime";

export const PublishManifestVersionSchema = z.literal("2.0.0");
export type PublishManifestVersion = z.infer<typeof PublishManifestVersionSchema>;

export const ProgressMappingConfigSchema = z.object({
  startProgress: z.number().min(0).max(1),
  endProgress: z.number().min(0).max(1),
  frameCount: z.number().int().positive(),
  frameRange: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }),
});
export type ProgressMappingConfig = z.infer<typeof ProgressMappingConfigSchema>;

export const FallbackConfigSchema = z.object({
  posterUrl: z.string().min(1).optional(),
  fallbackVideoUrl: z.string().min(1).optional(),
  firstFrameUrl: z.string().min(1).optional(),
  mobileBehavior: z.enum(["poster", "video", "sequence"]),
  reducedMotionBehavior: z.enum(["poster", "video", "sequence"]),
});
export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;

export const MotionSettingsSchema = z.object({
  sectionHeightVh: z.number().min(100).max(600),
  scrubStrength: z.number().min(0.05).max(4),
  durationSeconds: z.number().positive().optional(),
  easing: z.enum(["linear", "power2.out", "power3.out"]),
  pin: z.boolean(),
  preloadWindow: z.number().int().min(2).max(40),
});
export type MotionSettings = z.infer<typeof MotionSettingsSchema>;

export const ReadinessStatusSchema = z.enum(["ready", "blocked", "warning"]);
export type ReadinessStatus = z.infer<typeof ReadinessStatusSchema>;

export const ReadinessCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: ReadinessStatusSchema,
  message: z.string().min(1),
});
export type ReadinessCheck = z.infer<typeof ReadinessCheckSchema>;

export const PublishTargetSummarySchema = z.object({
  slug: z.string().min(1),
  targetType: z.enum(["hosted_embed", "script_embed"]),
  version: z.number().int().positive(),
  previewUrl: z.string().min(1),
  isReady: z.boolean(),
  publishedVersionId: z.string().uuid().optional(),
  publishedAt: z.string().datetime().optional(),
});
export type PublishTargetSummary = z.infer<typeof PublishTargetSummarySchema>;

export const ProjectMomentSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  timing: z.object({
    start: z.number().min(0).max(1),
    end: z.number().min(0).max(1),
  }),
});
export type ProjectMoment = z.infer<typeof ProjectMomentSchema>;

export const SectionTransitionSchema = z.object({
  id: z.string().min(1),
  scope: z.enum(["sequence", "moment"]),
  phase: z.enum(["enter", "exit"]).default("enter"),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  preset: z.enum(["fade", "crossfade", "wipe", "zoom-dissolve", "blur-dissolve"]),
  easing: z.enum(["linear", "ease-out", "ease-in-out", "back-out", "expo-out"]),
  duration: z.number().min(0.08).max(2.5),
});
export type SectionTransition = z.infer<typeof SectionTransitionSchema>;

export const BackgroundMediaSchema = z.object({
  assetId: z.string().min(1).optional(),
  url: z.string().min(1),
  previewUrl: z.string().min(1).optional(),
  posterUrl: z.string().min(1).optional(),
  metadata: OverlayMediaMetadataSchema.extend({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationMs: z.number().int().nonnegative().optional(),
  }).optional(),
});
export type BackgroundMedia = z.infer<typeof BackgroundMediaSchema>;

export const BackgroundVideoEndBehaviorSchema = z.enum(["loop", "hold", "stop"]);
export type BackgroundVideoEndBehavior = z.infer<typeof BackgroundVideoEndBehaviorSchema>;

export const BackgroundVideoRangeSchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive().optional(),
});
export type BackgroundVideoRange = z.infer<typeof BackgroundVideoRangeSchema>;

export const ProjectBackgroundTrackManifestSchema = z.object({
  id: z.string().min(1),
  start: z.number().min(0).max(1),
  end: z.number().min(0).max(1),
  media: BackgroundMediaSchema,
  endBehavior: BackgroundVideoEndBehaviorSchema.default("loop"),
  mediaRange: BackgroundVideoRangeSchema.optional(),
});
export type ProjectBackgroundTrackManifest = z.infer<typeof ProjectBackgroundTrackManifestSchema>;

export const ProjectBookmarkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  position: z.number().min(0).max(1),
});
export type ProjectBookmark = z.infer<typeof ProjectBookmarkSchema>;

export const ProjectCanvasManifestSchema = z.object({
  id: z.string().min(1),
  presetId: PresetIdSchema,
  title: z.string().min(1),
  frameAssets: z.array(FrameAssetSchema),
  frameCount: z.number().int().nonnegative(),
  progressMapping: ProgressMappingConfigSchema,
  backgroundColor: z.string().min(1).optional(),
  backgroundTrack: ProjectBackgroundTrackManifestSchema.optional(),
  fallback: FallbackConfigSchema,
  motion: MotionSettingsSchema,
  presetConfig: PresetSpecificConfigSchema,
  runtimeProfile: PresetRuntimeProfileSchema,
});
export type ProjectCanvasManifest = z.infer<typeof ProjectCanvasManifestSchema>;

export const ProjectSectionManifestSchema = z.object({
  id: z.string().min(1),
  presetId: PresetIdSchema,
  title: z.string().min(1),
  frameAssets: z.array(FrameAssetSchema),
  frameCount: z.number().int().nonnegative(),
  progressMapping: ProgressMappingConfigSchema,
  overlays: z.array(OverlayDefinitionSchema),
  moments: z.array(ProjectMomentSchema).default([]),
  transitions: z.array(SectionTransitionSchema).default([]),
  backgroundColor: z.string().min(1).optional(),
  backgroundMedia: BackgroundMediaSchema.optional(),
  backgroundVideoEndBehavior: BackgroundVideoEndBehaviorSchema.optional(),
  backgroundVideoRange: BackgroundVideoRangeSchema.optional(),
  fallback: FallbackConfigSchema,
  motion: MotionSettingsSchema,
  presetConfig: PresetSpecificConfigSchema,
  runtimeProfile: PresetRuntimeProfileSchema,
});
export type ProjectSectionManifest = z.infer<typeof ProjectSectionManifestSchema>;

export const ProjectManifestSchema = z.object({
  version: PublishManifestVersionSchema,
  project: z.object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    title: z.string().min(1),
    ownerId: z.string().min(1),
    publishVersion: z.number().int().positive(),
    latestPublishVersion: z.number().int().positive().optional(),
    lastPublishedAt: z.string().datetime().optional(),
    previewUrl: z.string().min(1),
  }),
  publishTarget: PublishTargetSummarySchema,
  selectedPreset: PresetIdSchema,
  canvas: ProjectCanvasManifestSchema,
  bookmarks: z.array(ProjectBookmarkSchema).default([]),
  layers: z.array(OverlayDefinitionSchema).default([]),
  generatedAt: z.string().datetime(),
});

type ProjectManifestBase = z.infer<typeof ProjectManifestSchema>;

export type ProjectManifest = ProjectManifestBase & {
  /**
   * Compatibility alias for code paths that still type against the old single-section runtime.
   * Active editor/runtime code should prefer `canvas`, `bookmarks`, and `layers`.
   */
  sections: ProjectSectionManifest[];
};
