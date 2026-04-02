import { z } from "zod";
import { OverlayDefinitionSchema } from "./overlays";
import {
  BackgroundMediaSchema,
  BackgroundVideoEndBehaviorSchema,
  BackgroundVideoRangeSchema,
} from "./manifest";
import { PresetIdSchema } from "./presets";

export const ProjectBookmarkDraftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  position: z.number().min(0).max(1),
});

export const ProjectBackgroundTrackDraftSchema = z.object({
  id: z.string().min(1),
  start: z.number().min(0).max(1),
  end: z.number().min(0).max(1),
  media: BackgroundMediaSchema,
  endBehavior: BackgroundVideoEndBehaviorSchema.default("loop"),
  mediaRange: BackgroundVideoRangeSchema.optional(),
});

export const ProjectCanvasDraftSchema = z.object({
  id: z.string().min(1).default("canvas-root"),
  scrollHeightVh: z.number().min(100).max(600),
  scrubStrength: z.number().min(0.05).max(4),
  frameRange: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }),
  backgroundColor: z.string().min(1).optional(),
  backgroundTrack: ProjectBackgroundTrackDraftSchema.optional(),
});

export const ProjectDraftDocumentSchema = z.object({
  version: z.literal(3).default(3),
  title: z.string().min(1),
  presetId: PresetIdSchema,
  canvas: ProjectCanvasDraftSchema,
  bookmarks: z.array(ProjectBookmarkDraftSchema).default([]),
  layers: z.array(OverlayDefinitionSchema).default([]),
});

export const ProjectDraftDocumentInputSchema = ProjectDraftDocumentSchema;

export const CheckpointPushRequestSchema = z.object({
  draft: ProjectDraftDocumentInputSchema,
  baseRevision: z.number().int().nonnegative().optional(),
});

export const CheckpointPushSuccessResponseSchema = z.object({
  ok: z.literal(true),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export const CheckpointPushConflictResponseSchema = z.object({
  ok: z.literal(false),
  conflict: z.literal(true),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export const CheckpointSnapshotResponseSchema = z.object({
  ok: z.literal(true),
  draft: ProjectDraftDocumentInputSchema,
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export type ProjectCanvasDraft = z.infer<typeof ProjectCanvasDraftSchema>;
export type ProjectBookmarkDraft = z.infer<typeof ProjectBookmarkDraftSchema>;
export type ProjectBackgroundTrackDraft = z.infer<typeof ProjectBackgroundTrackDraftSchema>;
export type ProjectDraftDocument = z.infer<typeof ProjectDraftDocumentSchema>;
export type ProjectDraftDocumentInput = z.infer<typeof ProjectDraftDocumentInputSchema>;
export type CheckpointPushRequest = z.infer<typeof CheckpointPushRequestSchema>;
export type CheckpointPushSuccessResponse = z.infer<typeof CheckpointPushSuccessResponseSchema>;
export type CheckpointPushConflictResponse = z.infer<typeof CheckpointPushConflictResponseSchema>;
export type CheckpointSnapshotResponse = z.infer<typeof CheckpointSnapshotResponseSchema>;
