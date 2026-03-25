import { z } from "zod";
import { FrameAssetSchema } from "./assets";
import { OverlayDefinitionSchema } from "./overlays";
import { PresetIdSchema, PresetSpecificConfigSchema } from "./presets";
import { PresetRuntimeProfileSchema } from "./preset-runtime";

export const PublishManifestVersionSchema = z.literal("1.0.0");
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

export const ProjectSectionManifestSchema = z.object({
  id: z.string().uuid(),
  presetId: PresetIdSchema,
  title: z.string().min(1),
  frameAssets: z.array(FrameAssetSchema),
  frameCount: z.number().int().nonnegative(),
  progressMapping: ProgressMappingConfigSchema,
  overlays: z.array(OverlayDefinitionSchema),
  moments: z.array(ProjectMomentSchema).default([]),
  transitions: z.array(SectionTransitionSchema).default([]),
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
  sections: z.array(ProjectSectionManifestSchema).min(1),
  generatedAt: z.string().datetime(),
});
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
