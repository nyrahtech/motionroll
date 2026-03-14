import { z } from "zod";
import { PresetIdSchema, type PresetId } from "./presets";

export const RequestedFallbackBehaviorSchema = z.enum(["poster", "video", "sequence"]);
export type RequestedFallbackBehavior = z.infer<typeof RequestedFallbackBehaviorSchema>;

export const ResolvedFallbackStrategySchema = z.enum([
  "sequence",
  "video",
  "poster",
  "first-frame",
  "disabled",
]);
export type ResolvedFallbackStrategy = z.infer<typeof ResolvedFallbackStrategySchema>;

export type PresetFallbackPolicy = {
  posterRequirement: "required" | "preferred";
  videoRequirement: "preferred" | "optional";
  allowFirstFrameFallback: boolean;
};

const presetFallbackPolicies = {
  "scroll-sequence": {
    posterRequirement: "required",
    videoRequirement: "optional",
    allowFirstFrameFallback: true,
  },
  "product-reveal": {
    posterRequirement: "required",
    videoRequirement: "preferred",
    allowFirstFrameFallback: true,
  },
  "feature-walkthrough": {
    posterRequirement: "required",
    videoRequirement: "preferred",
    allowFirstFrameFallback: true,
  },
  "before-after": {
    posterRequirement: "required",
    videoRequirement: "optional",
    allowFirstFrameFallback: true,
  },
  "device-spin": {
    posterRequirement: "preferred",
    videoRequirement: "optional",
    allowFirstFrameFallback: true,
  },
  "chaptered-scroll-story": {
    posterRequirement: "required",
    videoRequirement: "preferred",
    allowFirstFrameFallback: true,
  },
} satisfies Record<PresetId, PresetFallbackPolicy>;

export function getPresetFallbackPolicy(presetId: PresetId): PresetFallbackPolicy {
  return presetFallbackPolicies[presetId];
}

export function resolveFallbackStrategy(input: {
  requestedBehavior: RequestedFallbackBehavior;
  hasFrames: boolean;
  hasPoster: boolean;
  hasFallbackVideo: boolean;
  allowFirstFrameFallback?: boolean;
}): ResolvedFallbackStrategy {
  const allowFirstFrameFallback = input.allowFirstFrameFallback ?? true;
  const hasFirstFrame = allowFirstFrameFallback && input.hasFrames;

  if (input.requestedBehavior === "sequence" && input.hasFrames) {
    return "sequence";
  }

  if (input.requestedBehavior === "video" && input.hasFallbackVideo) {
    return "video";
  }

  if (input.hasPoster) {
    return "poster";
  }

  if (hasFirstFrame) {
    return "first-frame";
  }

  if (input.hasFallbackVideo) {
    return "video";
  }

  return "disabled";
}

export const FallbackCapabilitySchema = z.object({
  presetId: PresetIdSchema,
  mobileBehavior: RequestedFallbackBehaviorSchema,
  reducedMotionBehavior: RequestedFallbackBehaviorSchema,
  resolvedMobileStrategy: ResolvedFallbackStrategySchema,
  resolvedReducedMotionStrategy: ResolvedFallbackStrategySchema,
  hasPoster: z.boolean(),
  hasFallbackVideo: z.boolean(),
  hasFirstFrame: z.boolean(),
});
export type FallbackCapability = z.infer<typeof FallbackCapabilitySchema>;
