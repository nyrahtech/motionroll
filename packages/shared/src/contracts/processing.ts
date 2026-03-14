import { z } from "zod";
import { SourceOriginSchema, SourceTypeSchema } from "./assets";

export const RetentionPolicySchema = z.enum([
  "delete_after_success",
  "keep_source",
]);
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

export const ProcessingOutputTargetSchema = z.enum([
  "frames",
  "poster",
  "fallback_video",
  "manifest_fragment",
]);
export type ProcessingOutputTarget = z.infer<typeof ProcessingOutputTargetSchema>;

export const ProcessingJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);
export type ProcessingJobStatus = z.infer<typeof ProcessingJobStatusSchema>;

export const ProcessingJobPayloadSchema = z.object({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
  sourceType: SourceTypeSchema,
  sourceOrigin: SourceOriginSchema,
  retentionPolicy: RetentionPolicySchema,
  outputTargets: z.array(ProcessingOutputTargetSchema).min(1),
});
export type ProcessingJobPayload = z.infer<typeof ProcessingJobPayloadSchema>;

export const ProcessingOutputsSchema = z.object({
  posterUrl: z.string().min(1).optional(),
  fallbackVideoUrl: z.string().min(1).optional(),
  frameVariantBasePath: z.string().min(1).optional(),
  frameCount: z.number().int().nonnegative().optional(),
  fps: z.number().positive().optional(),
  error: z.string().optional(),
});
export type ProcessingOutputs = z.infer<typeof ProcessingOutputsSchema>;
