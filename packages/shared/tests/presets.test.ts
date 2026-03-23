import { describe, expect, it } from "vitest";
import { ProjectManifestSchema, presetDefinitions } from "../src";

describe("preset definitions", () => {
  it("ships the six required presets", () => {
    expect(presetDefinitions).toHaveLength(6);
    expect(presetDefinitions.map((preset) => preset.label)).toEqual([
      "Scroll Sequence",
      "Product Reveal",
      "Feature Walkthrough",
      "Before / After",
      "Device Spin",
      "Chaptered Scroll Story",
    ]);
  });

  it("includes meaningful starter overlays and controls", () => {
    for (const preset of presetDefinitions) {
      expect(preset.seededOverlays.length).toBeGreaterThan(0);
      expect(preset.exposedControls.some((control) => control.group === "common")).toBe(
        true,
      );
      expect(
        preset.exposedControls.some((control) => control.group === "preset"),
      ).toBe(true);
    }
  });
});

describe("project manifest", () => {
  it("validates a section manifest payload", () => {
    const result = ProjectManifestSchema.safeParse({
      version: "1.0.0",
      project: {
        id: "c4cc93ae-c988-48d7-9a76-9b85990fd2ca",
        slug: "demo",
        title: "Demo",
        ownerId: "user_test_123",
        publishVersion: 1,
        previewUrl: "http://localhost:3000/embed/demo",
      },
      publishTarget: {
        slug: "demo",
        targetType: "hosted_embed",
        version: 1,
        previewUrl: "http://localhost:3000/embed/demo",
        isReady: true,
      },
      selectedPreset: "scroll-sequence",
      generatedAt: new Date().toISOString(),
      sections: [
        {
          id: "3517be83-7f3c-4600-af7e-6385d4469113",
          presetId: "scroll-sequence",
          title: "Hero",
          frameAssets: [
            {
              index: 0,
              path: "frames/0001.jpg",
              variants: [
                {
                  kind: "desktop",
                  url: "https://example.com/frames/0001.jpg",
                  width: 1440,
                  height: 810,
                },
              ],
            },
          ],
          frameCount: 180,
          progressMapping: {
            startProgress: 0,
            endProgress: 1,
            frameCount: 180,
            frameRange: { start: 0, end: 179 },
          },
          overlays: presetDefinitions[0]!.seededOverlays,
          fallback: {
            posterUrl: "https://example.com/poster.jpg",
            fallbackVideoUrl: "https://example.com/fallback.mp4",
            mobileBehavior: "video",
            reducedMotionBehavior: "poster",
          },
          motion: {
            sectionHeightVh: 240,
            scrubStrength: 1,
            easing: "linear",
            pin: true,
            preloadWindow: 8,
          },
          presetConfig: {
            overlayStyle: "floating-card",
          },
          runtimeProfile: {
            presetId: "scroll-sequence",
            kind: "scroll-sequence",
            sequenceStrategy: "linear",
            overlayEntrance: "fade-up",
            chromeLabel: "Sequence",
            previewDescription:
              "Premium scroll-synced image sequence with caption-led pacing.",
            highlightMetricLabel: "Frame scrub",
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
