import { z } from "zod";
import { AssetMetadataSchema } from "./assets";

export const AiProviderSchema = z.enum(["runway", "luma", "sora", "other"]);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const ProviderConnectionStatusSchema = z.enum([
  "disconnected",
  "pending_validation",
  "connected",
  "error",
]);
export type ProviderConnectionStatus = z.infer<typeof ProviderConnectionStatusSchema>;

export const GenerationStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "unsupported",
]);
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

export const ProviderCredentialMetadataSchema = z.object({
  label: z.string().min(1),
  lastValidatedAt: z.string().datetime().optional(),
  supportedCapabilities: z.array(z.string()).default([]),
  unsupportedReason: z.string().optional(),
});
export type ProviderCredentialMetadata = z.infer<
  typeof ProviderCredentialMetadataSchema
>;

export const ProviderConnectionSchema = z.object({
  provider: AiProviderSchema,
  status: ProviderConnectionStatusSchema,
  accountLabel: z.string().min(1),
  metadata: ProviderCredentialMetadataSchema,
});
export type ProviderConnection = z.infer<typeof ProviderConnectionSchema>;

export const GeneratedAssetSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  previewUrl: z.string().min(1),
  durationMs: z.number().int().positive().optional(),
  metadata: AssetMetadataSchema.partial().extend({
    sourceUrl: z.string().min(1).optional(),
  }),
});
export type GeneratedAsset = z.infer<typeof GeneratedAssetSchema>;

export const CreateGenerationInputSchema = z.object({
  prompt: z.string().min(1),
  aspectRatio: z.string().min(1).default("16:9"),
  durationSeconds: z.number().int().positive().default(6),
});
export type CreateGenerationInput = z.infer<typeof CreateGenerationInputSchema>;

export const ConnectAccountInputSchema = z.object({
  accountLabel: z.string().min(1),
  credentials: z.record(z.string(), z.string()),
});
export type ConnectAccountInput = z.infer<typeof ConnectAccountInputSchema>;

export const ImportGeneratedAssetInputSchema = z.object({
  assetExternalId: z.string().min(1),
  projectId: z.string().uuid(),
});
export type ImportGeneratedAssetInput = z.infer<
  typeof ImportGeneratedAssetInputSchema
>;

export interface AiProviderAdapter {
  connectAccount(input: ConnectAccountInput): Promise<ProviderConnection>;
  validateCredentials(credentials: Record<string, string>): Promise<{
    valid: boolean;
    metadata: ProviderCredentialMetadata;
  }>;
  createGeneration(input: CreateGenerationInput): Promise<{
    generationId: string;
    status: GenerationStatus;
    message: string;
  }>;
  getGenerationStatus(generationId: string): Promise<{
    status: GenerationStatus;
    message: string;
  }>;
  listGeneratedAssets(connectionId: string): Promise<GeneratedAsset[]>;
  importGeneratedAsset(
    input: ImportGeneratedAssetInput,
  ): Promise<{
    imported: boolean;
    sourceUrl?: string;
    message: string;
  }>;
  disconnectAccount(connectionId: string): Promise<void>;
}
