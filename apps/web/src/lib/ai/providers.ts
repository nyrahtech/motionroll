/**
 * providers.ts — AI provider adapter layer.
 *
 * Real validateCredentials implementations ping each provider's cheapest endpoint.
 * Generation / polling / import remain stubbed for v1.
 */
import {
  type AiProvider,
  type AiProviderAdapter,
  type ConnectAccountInput,
  type CreateGenerationInput,
  type GeneratedAsset,
} from "@motionroll/shared";
import { logger } from "@/lib/logger";

type ValidationResult = { valid: boolean; reason?: string };

async function validateRunwayCredentials(creds: Record<string, string>): Promise<ValidationResult> {
  const apiKey = creds.apiKey ?? creds.api_key ?? creds.RUNWAYML_API_SECRET;
  if (!apiKey) return { valid: false, reason: "Missing Runway API key (field: apiKey)" };
  try {
    const res = await fetch("https://api.runwayml.com/v1/organization", {
      headers: { Authorization: `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 200) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, reason: "Invalid or expired Runway API key" };
    logger.warn("Runway credential check non-200", { status: res.status });
    return { valid: true, reason: `HTTP ${res.status} — accepted provisionally` };
  } catch (err) {
    return { valid: false, reason: `Could not reach Runway: ${err instanceof Error ? err.message : "network error"}` };
  }
}

async function validateLumaCredentials(creds: Record<string, string>): Promise<ValidationResult> {
  const apiKey = creds.apiKey ?? creds.api_key ?? creds.LUMAAI_API_KEY;
  if (!apiKey) return { valid: false, reason: "Missing Luma API key (field: apiKey)" };
  try {
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 200) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, reason: "Invalid or expired Luma API key" };
    return { valid: true, reason: `HTTP ${res.status} — accepted provisionally` };
  } catch (err) {
    return { valid: false, reason: `Could not reach Luma: ${err instanceof Error ? err.message : "network error"}` };
  }
}

async function validateSoraCredentials(creds: Record<string, string>): Promise<ValidationResult> {
  const apiKey = creds.apiKey ?? creds.api_key ?? creds.OPENAI_API_KEY;
  if (!apiKey) return { valid: false, reason: "Missing OpenAI API key (field: apiKey)" };
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 200) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, reason: "Invalid or expired OpenAI API key" };
    return { valid: true, reason: `HTTP ${res.status} — accepted provisionally` };
  } catch (err) {
    return { valid: false, reason: `Could not reach OpenAI: ${err instanceof Error ? err.message : "network error"}` };
  }
}

function stubbedAsset(provider: AiProvider): GeneratedAsset {
  return {
    externalId: `${provider}-sample-asset`,
    title: `${provider.toUpperCase()} sample asset`,
    previewUrl: "https://placehold.co/960x540/png",
    durationMs: 6000,
    metadata: { mimeType: "video/mp4", bytes: 0, sourceUrl: "https://example.com/not-implemented.mp4" },
  };
}

class MotionRollProviderAdapter implements AiProviderAdapter {
  constructor(private readonly provider: AiProvider) {}

  async connectAccount(input: ConnectAccountInput) {
    return {
      provider: this.provider,
      status: "pending_validation" as const,
      accountLabel: input.accountLabel,
      metadata: {
        label: `${this.provider} adapter`,
        supportedCapabilities: ["connection-persistence", "credential-validation"],
        unsupportedReason: undefined,
      },
    };
  }

  async validateCredentials(credentials: Record<string, string>) {
    let result: ValidationResult;
    switch (this.provider) {
      case "runway": result = await validateRunwayCredentials(credentials); break;
      case "luma":   result = await validateLumaCredentials(credentials);   break;
      case "sora":   result = await validateSoraCredentials(credentials);   break;
      default:       result = { valid: true, reason: "Validation not available for this provider" };
    }
    return {
      valid: result.valid,
      metadata: {
        label: `${this.provider} adapter`,
        supportedCapabilities: ["connection-persistence", "credential-validation"],
        unsupportedReason: result.valid ? undefined : (result.reason ?? "Invalid credentials"),
      },
    };
  }

  async createGeneration(input: CreateGenerationInput) {
    return {
      generationId: `${this.provider}-${Date.now()}`,
      status: "unsupported" as const,
      message: `Stored prompt "${input.prompt}" — live ${this.provider} calls not yet wired.`,
    };
  }

  async getGenerationStatus(_generationId: string) {
    return { status: "unsupported" as const, message: `${this.provider} polling not implemented yet.` };
  }

  async listGeneratedAssets(_connectionId: string) {
    return [stubbedAsset(this.provider)];
  }

  async importGeneratedAsset(_input: { assetExternalId: string; projectId: string }) {
    return { imported: false, sourceUrl: "https://example.com/not-implemented.mp4", message: "Live provider downloads are a documented next step." };
  }

  async disconnectAccount(_connectionId: string) { return; }
}

export function getAiProviderAdapter(provider: AiProvider): AiProviderAdapter {
  return new MotionRollProviderAdapter(provider);
}
