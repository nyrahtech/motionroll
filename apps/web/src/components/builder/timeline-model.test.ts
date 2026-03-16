import { describe, expect, it } from "vitest";
import type { ProjectManifest } from "@motionroll/shared";
import {
  deriveTimelineTracks,
  getFrameRangeFromClip,
  getTimelineProgressFromPointer,
  getTimelineStepProgress,
  getTimelineZoomWidth,
  moveTimelineClip,
  resizeTimelineClip,
  snapTimelineValue,
} from "./timeline-model";

describe("timeline-model", () => {
  it("snaps values to nearby ruler points", () => {
    expect(snapTimelineValue(0.248, [0.25, 0.5])).toBe(0.25);
    expect(snapTimelineValue(0.41, [0.25, 0.5])).toBe(0.41);
  });

  it("moves clips while preserving duration and clamping to the rail", () => {
    expect(moveTimelineClip({ start: 0.1, end: 0.3 }, 0.1, [0.2, 0.4])).toEqual({
      start: 0.2,
      end: 0.4,
    });

    expect(moveTimelineClip({ start: 0.82, end: 0.98 }, 0.1, [1])).toEqual({
      start: 0.84,
      end: 1,
    });
  });

  it("resizes clips from either edge with snapping and minimum width", () => {
    expect(resizeTimelineClip({ start: 0.2, end: 0.5 }, "start", 0.26, [0.25])).toEqual({
      start: 0.25,
      end: 0.5,
    });

    const resized = resizeTimelineClip({ start: 0.2, end: 0.5 }, "end", 0.18, [0.18]);
    expect(resized.start).toBeCloseTo(0.2);
    expect(resized.end).toBeCloseTo(0.24);
  });

  it("maps pointer positions into clamped progress values", () => {
    expect(getTimelineProgressFromPointer(150, 100, 200)).toBe(0.25);
    expect(getTimelineProgressFromPointer(50, 100, 200)).toBe(0);
    expect(getTimelineProgressFromPointer(340, 100, 200)).toBe(1);
  });

  it("derives zoomed timeline widths and stable step sizes", () => {
    expect(getTimelineZoomWidth(640, 12, 0.7)).toBeGreaterThanOrEqual(640);
    expect(getTimelineZoomWidth(640, 12, 2)).toBeGreaterThan(getTimelineZoomWidth(640, 12, 1));
    expect(getTimelineStepProgress(10)).toBeGreaterThan(0);
  });

  it("maps a trimmed sequence span back to inclusive frame indices", () => {
    expect(getFrameRangeFromClip({ start: 0.1, end: 0.5 }, 100)).toEqual({
      start: 10,
      end: 50,
    });
  });

  it("derives stacked layer rows from overlay order", () => {
    const tracks = deriveTimelineTracks(
      {
        version: "1.0.0",
        generatedAt: new Date(0).toISOString(),
        selectedPreset: "product-reveal",
        project: {
          id: "11111111-1111-1111-1111-111111111111",
          slug: "demo",
          title: "Demo",
          ownerId: "local",
          publishVersion: 1,
          previewUrl: "/projects/demo/preview",
        },
        publishTarget: {
          slug: "demo",
          targetType: "hosted_embed",
          version: 1,
          previewUrl: "/projects/demo/preview",
          isReady: true,
        },
        sections: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            presetId: "product-reveal",
            title: "Section",
            frameAssets: [],
            frameCount: 12,
            progressMapping: {
              startProgress: 0,
              endProgress: 1,
              frameCount: 12,
              frameRange: { start: 0, end: 11 },
            },
            overlays: [
              {
                id: "top",
                timing: { start: 0.2, end: 0.5 },
                content: { headline: "Top", body: "Layer", align: "start", theme: "dark", treatment: "default", layer: 1 },
              },
              {
                id: "bottom",
                timing: { start: 0.1, end: 0.4 },
                content: { headline: "Bottom", body: "Layer", align: "start", theme: "light", treatment: "default", layer: 0 },
              },
            ],
            moments: [],
            transitions: [],
            fallback: {
              posterUrl: "/poster.png",
              mobileBehavior: "poster",
              reducedMotionBehavior: "poster",
            },
            motion: {
              sectionHeightVh: 220,
              scrubStrength: 1,
              easing: "linear",
              pin: true,
              preloadWindow: 4,
            },
            presetConfig: {},
            runtimeProfile: {
              presetId: "product-reveal",
              kind: "product-reveal",
              sequenceStrategy: "spotlight",
              chromeLabel: "Preview",
              previewDescription: "Demo",
              overlayEntrance: "fade-up",
              highlightMetricLabel: "Spotlight",
            },
          },
        ],
      },
      8,
    );

    expect(tracks.map((track) => track.type)).toEqual(["section", "layer", "layer"]);
    expect(tracks[1]?.clips[0]?.id).toBe("layer-top");
    expect(tracks[1]?.clips[0]?.start).toBe(0.2);
    expect(tracks[2]?.clips[0]?.id).toBe("layer-bottom");
  });

  it("samples sequence thumbnails with the same frame mapping as preview", () => {
    const tracks = deriveTimelineTracks(
      {
        version: "1.0.0",
        generatedAt: new Date(0).toISOString(),
        selectedPreset: "product-reveal",
        project: {
          id: "11111111-1111-1111-1111-111111111111",
          slug: "demo",
          title: "Demo",
          ownerId: "local",
          publishVersion: 1,
          previewUrl: "/projects/demo/preview",
        },
        publishTarget: {
          slug: "demo",
          targetType: "hosted_embed",
          version: 1,
          previewUrl: "/projects/demo/preview",
          isReady: true,
        },
        sections: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            presetId: "product-reveal",
            title: "Section",
            frameAssets: [
              {
                index: 10,
                path: "frame-10",
                variants: [{ kind: "desktop", url: "/frames/10.jpg" }],
              },
              {
                index: 15,
                path: "frame-15",
                variants: [{ kind: "desktop", url: "/frames/15.jpg" }],
              },
              {
                index: 19,
                path: "frame-19",
                variants: [{ kind: "desktop", url: "/frames/19.jpg" }],
              },
            ],
            frameCount: 20,
            progressMapping: {
              startProgress: 0,
              endProgress: 1,
              frameCount: 20,
              frameRange: { start: 10, end: 19 },
            },
            overlays: [],
            moments: [],
            transitions: [],
            fallback: {
              posterUrl: "/poster.png",
              mobileBehavior: "poster",
              reducedMotionBehavior: "poster",
            },
            motion: {
              sectionHeightVh: 220,
              scrubStrength: 1,
              easing: "linear",
              pin: true,
              preloadWindow: 4,
            },
            presetConfig: {},
            runtimeProfile: {
              presetId: "product-reveal",
              kind: "product-reveal",
              sequenceStrategy: "spotlight",
              chromeLabel: "Preview",
              previewDescription: "Demo",
              overlayEntrance: "fade-up",
              highlightMetricLabel: "Spotlight",
            },
          },
        ],
      },
      8,
    );

    const frameStrip = tracks[0]?.clips[0]?.metadata?.frameStrip ?? [];
    expect(frameStrip[0]).toBe("/frames/10.jpg");
    expect(frameStrip[Math.floor(frameStrip.length / 2)]).toBe("/frames/15.jpg");
    expect(frameStrip.at(-1)).toBe("/frames/19.jpg");
  });

  it("matches thumbnail variants to the active preview mode", () => {
    const manifest: ProjectManifest = {
      version: "1.0.0",
      generatedAt: new Date(0).toISOString(),
      selectedPreset: "product-reveal",
      project: {
        id: "11111111-1111-1111-1111-111111111111",
        slug: "demo",
        title: "Demo",
        ownerId: "local",
        publishVersion: 1,
        previewUrl: "/projects/demo/preview",
      },
      publishTarget: {
        slug: "demo",
        targetType: "hosted_embed",
        version: 1,
        previewUrl: "/projects/demo/preview",
        isReady: true,
      },
      sections: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          presetId: "product-reveal",
          title: "Section",
          frameAssets: [
            {
              index: 0,
              path: "frame-0",
              variants: [
                { kind: "desktop", url: "/frames/desktop-0.jpg" },
                { kind: "mobile", url: "/frames/mobile-0.jpg" },
              ],
            },
            {
              index: 11,
              path: "frame-11",
              variants: [
                { kind: "desktop", url: "/frames/desktop-11.jpg" },
                { kind: "mobile", url: "/frames/mobile-11.jpg" },
              ],
            },
          ],
          frameCount: 12,
          progressMapping: {
            startProgress: 0,
            endProgress: 1,
            frameCount: 12,
            frameRange: { start: 0, end: 11 },
          },
          overlays: [],
          moments: [],
          transitions: [],
          fallback: {
            posterUrl: "/poster.png",
            mobileBehavior: "poster",
            reducedMotionBehavior: "poster",
          },
          motion: {
            sectionHeightVh: 220,
            scrubStrength: 1,
            easing: "linear",
            pin: true,
            preloadWindow: 4,
          },
          presetConfig: {},
          runtimeProfile: {
            presetId: "product-reveal",
            kind: "product-reveal",
            sequenceStrategy: "spotlight",
            chromeLabel: "Preview",
            previewDescription: "Demo",
            overlayEntrance: "fade-up",
            highlightMetricLabel: "Spotlight",
          },
        },
      ],
    };

    const desktopTracks = deriveTimelineTracks(manifest, 8, "desktop");
    const mobileTracks = deriveTimelineTracks(manifest, 8, "mobile");

    expect(desktopTracks[0]?.clips[0]?.metadata?.frameStrip?.[0]).toBe("/frames/desktop-0.jpg");
    expect(mobileTracks[0]?.clips[0]?.metadata?.frameStrip?.[0]).toBe("/frames/mobile-0.jpg");
  });
});
