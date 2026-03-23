import { describe, expect, it } from "vitest";
import {
  buildSectionManifest,
  normalizeFrameAssets,
  normalizeFrameRange,
  resolveManifestFallback,
} from "./manifest-helpers";

describe("normalizeFrameAssets", () => {
  it("sorts frame assets by frame index", () => {
    const frames = normalizeFrameAssets([
      {
        kind: "frame",
        storageKey: "frame-02",
        publicUrl: "https://example.com/02.jpg",
        metadata: { frameIndex: 2 },
        variants: [{ kind: "desktop", publicUrl: "https://example.com/02.jpg", metadata: {} }],
      },
      {
        kind: "frame",
        storageKey: "frame-01",
        publicUrl: "https://example.com/01.jpg",
        metadata: { frameIndex: 1 },
        variants: [{ kind: "desktop", publicUrl: "https://example.com/01.jpg", metadata: {} }],
      },
    ]);

    expect(frames.map((frame) => frame.index)).toEqual([1, 2]);
  });
});

describe("normalizeFrameRange", () => {
  it("clamps the frame range to the actual frame count", () => {
    expect(normalizeFrameRange({ start: 12, end: 40 }, 8)).toEqual({
      start: 6,
      end: 7,
    });
  });
});

describe("resolveManifestFallback", () => {
  it("resolves missing video to a poster-safe fallback", () => {
    expect(
      resolveManifestFallback({
        presetId: "product-reveal",
        requestedMobileBehavior: "video",
        requestedReducedMotionBehavior: "poster",
        frameAssets: [
          {
            index: 0,
            path: "frame-0",
            variants: [
              {
                kind: "desktop",
                url: "https://example.com/frame-0.jpg",
                width: 1440,
                height: 900,
              },
            ],
          },
        ],
        posterUrl: "https://example.com/poster.jpg",
      }),
    ).toMatchObject({
      posterUrl: "https://example.com/poster.jpg",
      firstFrameUrl: "https://example.com/frame-0.jpg",
      mobileBehavior: "poster",
      reducedMotionBehavior: "poster",
    });
  });
});

describe("buildSectionManifest", () => {
  it("adds preset runtime metadata and normalized fallback config", () => {
    const manifest = buildSectionManifest({
      section: {
        id: "3517be83-7f3c-4600-af7e-6385d4469113",
        presetId: "chaptered-scroll-story",
        title: "Primary section",
        commonConfig: {
          sectionHeightVh: 420,
          scrubStrength: 0.7,
          frameRange: { start: 0, end: 179 },
          fallbackBehavior: {
            mobile: "video",
            reducedMotion: "poster",
          },
          motion: {
            easing: "linear",
            pin: true,
            preloadWindow: 8,
          },
        },
        presetConfig: {
          chapterCount: 4,
        },
      },
      overlays: [
        {
          overlayKey: "chapter-1",
          timing: { start: 0.03, end: 0.18 },
          content: {
            text: "Set the tone\n\nOpen the story with a stronger chapter card.",
            align: "start",
            theme: "accent",
            treatment: "default",
          },
        },
      ],
      assets: [
        {
          kind: "frame_sequence",
          storageKey: "derived/frames",
          publicUrl: "https://example.com/frames",
          metadata: { frameCount: 180 },
          variants: [],
        },
        {
          kind: "frame",
          storageKey: "derived/frame-00000",
          publicUrl: "https://example.com/frame-0.jpg",
          metadata: { frameIndex: 0 },
          variants: [{ kind: "desktop", publicUrl: "https://example.com/frame-0.jpg", metadata: {} }],
        },
        {
          kind: "poster",
          storageKey: "derived/poster.jpg",
          publicUrl: "https://example.com/poster.jpg",
          metadata: {},
          variants: [],
        },
      ],
    });

    expect(manifest.runtimeProfile.kind).toBe("chaptered-scroll-story");
    expect(manifest.fallback.posterUrl).toBe("https://example.com/poster.jpg");
    expect(manifest.fallback.firstFrameUrl).toBe("https://example.com/frame-0.jpg");
    expect(manifest.frameCount).toBe(180);
    expect(manifest.overlays[0]?.content.treatment).toBe("default");
  });

  it("preserves explicit layer ordering for runtime stacking", () => {
    const manifest = buildSectionManifest({
      section: {
        id: "3517be83-7f3c-4600-af7e-6385d4469114",
        presetId: "product-reveal",
        title: "Layered section",
        commonConfig: {
          sectionHeightVh: 240,
          scrubStrength: 1,
          frameRange: { start: 0, end: 1 },
          fallbackBehavior: {
            mobile: "poster",
            reducedMotion: "poster",
          },
          motion: {
            easing: "linear",
            pin: true,
            preloadWindow: 4,
          },
        },
        presetConfig: {},
      },
      overlays: [
        {
          overlayKey: "top",
          timing: { start: 0.1, end: 0.8 },
          content: {
            text: "Top\n\nOn top",
            align: "start",
            theme: "light",
            treatment: "default",
            layer: 3,
          },
        },
        {
          overlayKey: "bottom",
          timing: { start: 0.1, end: 0.8 },
          content: {
            text: "Bottom\n\nBehind",
            align: "start",
            theme: "dark",
            treatment: "default",
            layer: 0,
          },
        },
      ],
      assets: [],
    });

    expect(manifest.overlays.map((overlay) => overlay.id)).toEqual(["bottom", "top"]);
    expect(manifest.overlays.map((overlay) => overlay.content.layer)).toEqual([0, 3]);
  });

  it("caps stale bundled MotionRoll demo frame packs to shipped frame availability", () => {
    const manifest = buildSectionManifest({
      section: {
        id: "3517be83-7f3c-4600-af7e-6385d4469115",
        presetId: "scroll-sequence",
        title: "Bundled demo section",
        commonConfig: {
          sectionHeightVh: 420,
          scrubStrength: 0.85,
          frameRange: { start: 0, end: 320 },
          fallbackBehavior: {
            mobile: "sequence",
            reducedMotion: "sequence",
          },
          motion: {
            easing: "linear",
            pin: true,
            preloadWindow: 6,
          },
        },
        presetConfig: {},
      },
      overlays: [],
      assets: [
        {
          kind: "frame_sequence",
          storageKey: "motionroll_demo_sequence/sequence.json",
          publicUrl: "/motionroll_demo_sequence/poster.webp",
          metadata: { frameCount: 321 },
          variants: [],
        },
        ...Array.from({ length: 321 }, (_, index) => ({
          kind: "frame",
          storageKey: `motionroll_demo_sequence/frames/frame-${String(index + 1).padStart(4, "0")}.webp`,
          publicUrl: `/motionroll_demo_sequence/frames/frame-${String(index + 1).padStart(4, "0")}.webp`,
          metadata: { frameIndex: index },
          variants: [
            {
              kind: "desktop",
              publicUrl: `/motionroll_demo_sequence/frames/frame-${String(index + 1).padStart(4, "0")}.webp`,
              metadata: {},
            },
          ],
        })),
      ],
    });

    expect(manifest.frameCount).toBe(47);
    expect(manifest.frameAssets).toHaveLength(47);
    expect(manifest.progressMapping.frameRange.end).toBe(46);
  });

  it("synthesizes bundled MotionRoll demo frames when the seed omits per-frame asset rows", () => {
    const manifest = buildSectionManifest({
      section: {
        id: "3517be83-7f3c-4600-af7e-6385d4469116",
        presetId: "scroll-sequence",
        title: "Minimal bundled demo section",
        commonConfig: {
          sectionHeightVh: 420,
          scrubStrength: 0.85,
          frameRange: { start: 0, end: 320 },
          fallbackBehavior: {
            mobile: "sequence",
            reducedMotion: "sequence",
          },
          motion: {
            easing: "linear",
            pin: true,
            preloadWindow: 6,
          },
        },
        presetConfig: {},
      },
      overlays: [],
      assets: [
        {
          kind: "frame_sequence",
          storageKey: "demo/demo-motionroll-editor-user/sequence.json",
          publicUrl: "/motionroll_demo_sequence/poster.webp",
          metadata: { frameCount: 47 },
          variants: [],
        },
        {
          kind: "poster",
          storageKey: "motionroll_demo_sequence/poster.webp",
          publicUrl: "/motionroll_demo_sequence/poster.webp",
          metadata: {},
          variants: [],
        },
      ],
    });

    expect(manifest.frameCount).toBe(47);
    expect(manifest.frameAssets).toHaveLength(47);
    expect(manifest.frameAssets[0]?.variants[0]?.url).toBe(
      "/motionroll_demo_sequence/frames/frame-0001.webp",
    );
    expect(manifest.progressMapping.frameRange.end).toBe(46);
  });
});
