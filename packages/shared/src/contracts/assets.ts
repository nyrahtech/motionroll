import { z } from "zod";

export const SourceTypeSchema = z.enum(["video", "ai_clip"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceOriginSchema = z.enum(["upload", "ai_import"]);
export type SourceOrigin = z.infer<typeof SourceOriginSchema>;

export const AssetKindSchema = z.enum([
  "source_video",
  "frame_sequence",
  "frame",
  "poster",
  "fallback_video",
  "thumbnail",
]);
export type AssetKind = z.infer<typeof AssetKindSchema>;

export const AssetVariantKindSchema = z.enum([
  "original",
  "desktop",
  "tablet",
  "mobile",
  "poster",
  "fallback_video",
]);
export type AssetVariantKind = z.infer<typeof AssetVariantKindSchema>;

export const AssetMetadataSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  fps: z.number().positive().optional(),
  frameCount: z.number().int().nonnegative().optional(),
  mimeType: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().min(16).optional(),
  originalFilename: z.string().min(1).optional(),
});
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

export const AssetVariantMetadataSchema = z.object({
  kind: AssetVariantKindSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().nonnegative(),
  format: z.enum(["jpg", "png", "webp", "mp4", "json"]),
  frameCount: z.number().int().nonnegative().optional(),
  fps: z.number().positive().optional(),
});
export type AssetVariantMetadata = z.infer<typeof AssetVariantMetadataSchema>;

export const FrameAssetSchema = z.object({
  index: z.number().int().nonnegative(),
  path: z.string().min(1),
  variants: z.array(
    z.object({
      kind: AssetVariantKindSchema,
      url: z.string().min(1),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    }),
  ),
});
export type FrameAsset = z.infer<typeof FrameAssetSchema>;
