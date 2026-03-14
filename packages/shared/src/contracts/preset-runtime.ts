import { z } from "zod";
import { PresetIdSchema, type PresetId, presetDefinitionMap } from "./presets";

export const PresetRuntimeKindSchema = z.enum([
  "scroll-sequence",
  "product-reveal",
  "feature-walkthrough",
  "before-after",
  "device-spin",
  "chaptered-scroll-story",
]);
export type PresetRuntimeKind = z.infer<typeof PresetRuntimeKindSchema>;

export const PresetRuntimeProfileSchema = z.object({
  presetId: PresetIdSchema,
  kind: PresetRuntimeKindSchema,
  sequenceStrategy: z.enum(["linear", "spotlight", "step-focus", "comparison", "spin", "chaptered"]),
  overlayEntrance: z.enum(["fade-up", "crossfade", "chapter-card"]),
  chromeLabel: z.string().min(1),
  previewDescription: z.string().min(1),
  highlightMetricLabel: z.string().min(1),
});
export type PresetRuntimeProfile = z.infer<typeof PresetRuntimeProfileSchema>;

export const presetRuntimeProfiles: Record<PresetId, PresetRuntimeProfile> = {
  "scroll-sequence": {
    presetId: "scroll-sequence",
    kind: "scroll-sequence",
    sequenceStrategy: "linear",
    overlayEntrance: "fade-up",
    chromeLabel: "Sequence",
    previewDescription: "Premium scroll-synced image sequence with caption-led pacing.",
    highlightMetricLabel: "Frame scrub",
  },
  "product-reveal": {
    presetId: "product-reveal",
    kind: "product-reveal",
    sequenceStrategy: "spotlight",
    overlayEntrance: "fade-up",
    chromeLabel: "Reveal",
    previewDescription: "Lead with the hero object, then land feature callouts in deliberate beats.",
    highlightMetricLabel: "Spotlight",
  },
  "feature-walkthrough": {
    presetId: "feature-walkthrough",
    kind: "feature-walkthrough",
    sequenceStrategy: "step-focus",
    overlayEntrance: "crossfade",
    chromeLabel: "Walkthrough",
    previewDescription: "Step-based overlay pacing for product and UI education moments.",
    highlightMetricLabel: "Steps",
  },
  "before-after": {
    presetId: "before-after",
    kind: "before-after",
    sequenceStrategy: "comparison",
    overlayEntrance: "crossfade",
    chromeLabel: "Compare",
    previewDescription: "A transformation story that keeps the before/after contrast obvious.",
    highlightMetricLabel: "Comparison",
  },
  "device-spin": {
    presetId: "device-spin",
    kind: "device-spin",
    sequenceStrategy: "spin",
    overlayEntrance: "fade-up",
    chromeLabel: "Spin",
    previewDescription: "Deterministic turntable playback for hardware and industrial design showcases.",
    highlightMetricLabel: "Rotation",
  },
  "chaptered-scroll-story": {
    presetId: "chaptered-scroll-story",
    kind: "chaptered-scroll-story",
    sequenceStrategy: "chaptered",
    overlayEntrance: "chapter-card",
    chromeLabel: "Story",
    previewDescription: "Slower cinematic progression with chapter markers and narrative overlays.",
    highlightMetricLabel: "Chapters",
  },
};

export function getPresetRuntimeProfile(presetId: PresetId) {
  return presetRuntimeProfiles[presetId];
}

export function getPresetDefinition(presetId: PresetId) {
  const definition = presetDefinitionMap.get(presetId);
  if (!definition) {
    throw new Error(`Unknown preset definition: ${presetId}`);
  }
  return definition;
}

