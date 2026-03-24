import { z } from "zod";
import { OverlayDefinitionSchema } from "./overlays";
import { SectionTransitionSchema } from "./manifest";
import { PresetIdSchema } from "./presets";

const SceneTransitionPresetSchema = z.enum([
  "none",
  ...SectionTransitionSchema.shape.preset.options,
]);

export const ProjectDraftDocumentSchema = z.object({
  version: z.literal(1).default(1),
  title: z.string().min(1),
  presetId: PresetIdSchema,
  sectionTitle: z.string().min(1),
  sceneTransitionPreset: SceneTransitionPresetSchema.default("none"),
  sectionHeightVh: z.number().min(100).max(600),
  scrubStrength: z.number().min(0.05).max(4),
  frameRangeStart: z.number().int().nonnegative(),
  frameRangeEnd: z.number().int().positive(),
  layerCount: z.number().int().min(1).max(64).default(1),
  overlays: z.array(OverlayDefinitionSchema),
});

export type ProjectDraftDocument = z.infer<typeof ProjectDraftDocumentSchema>;
