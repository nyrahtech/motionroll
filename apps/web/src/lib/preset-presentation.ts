import type { PresetId } from "@motionroll/shared";

export const presetPresentation = {
  "product-reveal": {
    category: "Launch",
    bestFor: "Hero product storytelling",
    sourceHint: "Works best with turntable captures, launch films, or clean AI rotations.",
    pace: "Recommended",
    heroLabel: "Recommended starting point",
  },
  "feature-walkthrough": {
    category: "Education",
    bestFor: "Explaining workflows or interface moments",
    sourceHint: "Best with short UI walkthrough clips and clear focus moments.",
    pace: "Structured",
    heroLabel: "Guided narrative",
  },
  "scroll-sequence": {
    category: "Cinematic",
    bestFor: "Minimal scroll-scrubbed storytelling",
    sourceHint: "Best with one strong cinematic video clip.",
    pace: "Clean",
    heroLabel: "Pure sequence",
  },
  "before-after": {
    category: "Comparison",
    bestFor: "Transformation stories and upgrade narratives",
    sourceHint: "Best with visually obvious before/after transitions.",
    pace: "Contrast",
    heroLabel: "Transformation",
  },
  "device-spin": {
    category: "Hardware",
    bestFor: "360-style product spins and industrial design reveals",
    sourceHint: "Best with turntable captures, packshots, or rotational renders.",
    pace: "Controlled",
    heroLabel: "Hardware showcase",
  },
  "chaptered-scroll-story": {
    category: "Narrative",
    bestFor: "Longer-form scroll chapters in a single section",
    sourceHint: "Best with one strong cinematic source and room for chapter copy.",
    pace: "Long-form",
    heroLabel: "Story mode",
  },
} satisfies Record<
  PresetId,
  {
    category: string;
    bestFor: string;
    sourceHint: string;
    pace: string;
    heroLabel: string;
  }
>;

export function getPresetPresentation(presetId: PresetId) {
  return presetPresentation[presetId];
}
