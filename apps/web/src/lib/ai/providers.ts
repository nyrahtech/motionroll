import {
  type AiProvider,
  type AiProviderAdapter,
  type ConnectAccountInput,
  type CreateGenerationInput,
  type GeneratedAsset,
} from "@motionroll/shared";

function stubbedAsset(provider: AiProvider): GeneratedAsset {
  return {
    externalId: `${provider}-sample-asset`,
    title: `${provider.toUpperCase()} sample asset`,
    previewUrl: "https://placehold.co/960x540/png",
    durationMs: 6000,
    metadata: {
      mimeType: "video/mp4",
      bytes: 0,
      sourceUrl: "https://example.com/not-implemented.mp4",
    },
  };
}

class HonestStubAdapter implements AiProviderAdapter {
  constructor(private readonly provider: AiProvider) {}

  async connectAccount(input: ConnectAccountInput) {
    return {
      provider: this.provider,
      status: "pending_validation" as const,
      accountLabel: input.accountLabel,
      metadata: {
        label: `${this.provider} adapter scaffold`,
        supportedCapabilities: ["connection-persistence", "asset-import-hand-off"],
        unsupportedReason:
          "Live provider API calls are intentionally stubbed in MotionRoll v1.",
      },
    };
  }

  async validateCredentials(_credentials: Record<string, string>) {
    return {
      valid: false,
      metadata: {
        label: `${this.provider} adapter scaffold`,
        supportedCapabilities: ["connection-persistence"],
        unsupportedReason:
          "Credential validation is a scaffold in v1. Persisted connection state is real, provider API calls are not.",
      },
    };
  }

  async createGeneration(input: CreateGenerationInput) {
    return {
      generationId: `${this.provider}-${Date.now()}`,
      status: "unsupported" as const,
      message: `Generation scaffolding stored prompt "${input.prompt}" but did not call ${this.provider}.`,
    };
  }

  async getGenerationStatus(_generationId: string) {
    return {
      status: "unsupported" as const,
      message: `${this.provider} generation polling is not implemented in v1.`,
    };
  }

  async listGeneratedAssets(_connectionId: string) {
    return [stubbedAsset(this.provider)];
  }

  async importGeneratedAsset(_input: {
    assetExternalId: string;
    projectId: string;
  }) {
    return {
      imported: false,
      sourceUrl: "https://example.com/not-implemented.mp4",
      message:
        "Provider import is wired into the MotionRoll pipeline contract, but live provider downloads remain a documented next step.",
    };
  }

  async disconnectAccount(_connectionId: string) {
    return;
  }
}

export function getAiProviderAdapter(provider: AiProvider) {
  return new HonestStubAdapter(provider);
}
