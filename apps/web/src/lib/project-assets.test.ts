import { describe, expect, it } from "vitest";
import {
  collectReferencedMediaAssetIds,
  getDerivedAssetsSnapshot,
  getPrimarySourceAsset,
  getRenderableAssetPreview,
  getSourceAssetValidationError,
  rewriteManifestMediaUrls,
} from "./project-assets";

describe("project asset helpers", () => {
  it("prefers the active primary source asset", () => {
    const asset = getPrimarySourceAsset([
      {
        id: "older",
        kind: "source_video",
        isPrimary: false,
        storageKey: "older.mp4",
        publicUrl: "/older.mp4",
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
      },
      {
        id: "newer",
        kind: "source_video",
        isPrimary: true,
        storageKey: "newer.mp4",
        publicUrl: "/newer.mp4",
        createdAt: new Date("2026-03-11T00:00:00.000Z"),
      },
    ]);

    expect(asset?.id).toBe("newer");
  });

  it("handles JSON date strings when choosing the primary source asset", () => {
    const asset = getPrimarySourceAsset([
      {
        id: "older",
        kind: "source_video",
        isPrimary: true,
        storageKey: "older.mp4",
        publicUrl: "/older.mp4",
        updatedAt: "2026-03-10T00:00:00.000Z",
      },
      {
        id: "newer",
        kind: "source_video",
        isPrimary: true,
        storageKey: "newer.mp4",
        publicUrl: "/newer.mp4",
        updatedAt: "2026-03-11T00:00:00.000Z",
      },
    ]);

    expect(asset?.id).toBe("newer");
  });

  it("filters source assets out of the derived snapshot", () => {
    const derived = getDerivedAssetsSnapshot([
      { kind: "source_video", storageKey: "source.mp4", publicUrl: "/source.mp4" },
      { kind: "poster", storageKey: "poster.png", publicUrl: "/poster.png" },
      { kind: "frame", storageKey: "frame-0.png", publicUrl: "/frame-0.png" },
    ]);

    expect(derived.map((asset) => asset.kind).sort()).toEqual(["frame", "poster"]);
  });

  it("falls back to poster or first frame for preview imagery", () => {
    expect(
      getRenderableAssetPreview(
        { kind: "frame_sequence", storageKey: "sequence", publicUrl: "" },
        [
          { kind: "poster", storageKey: "poster.png", publicUrl: "/poster.png" },
          { kind: "frame", storageKey: "frame-0.png", publicUrl: "/frame-0.png" },
        ],
      ),
    ).toBe("/poster.png");
  });

  it("rewrites storage-hosted previews through the app storage route", () => {
    expect(
      getRenderableAssetPreview(
        {
          kind: "poster",
          storageKey: "project/derived/poster.jpg",
          publicUrl: "http://127.0.0.1:9000/motionroll-assets/project/derived/poster.jpg",
        },
        [],
      ),
    ).toBe("http://localhost:3000/api/storage/project/derived/poster.jpg");
  });

  it("validates processable source assets consistently", () => {
    expect(
      getSourceAssetValidationError({
        projectId: "project-1",
        sourceType: "video",
        sourceOrigin: "upload",
        maxBytes: 1_000,
        asset: {
          projectId: "project-1",
          kind: "source_video",
          isPrimary: true,
          sourceType: "video",
          sourceOrigin: "upload",
          publicUrl: "/video.mp4",
          metadata: { bytes: 900 },
        },
      }),
    ).toBeNull();

    expect(
      getSourceAssetValidationError({
        projectId: "project-1",
        sourceType: "video",
        sourceOrigin: "upload",
        asset: {
          projectId: "project-2",
          kind: "source_video",
          isPrimary: true,
          sourceType: "video",
          sourceOrigin: "upload",
          publicUrl: "/video.mp4",
        },
      }),
    ).toBe("Asset does not belong to the requested project.");

    expect(
      getSourceAssetValidationError({
        projectId: "project-1",
        sourceType: "ai_clip",
        sourceOrigin: "ai_import",
        maxBytes: 1_000,
        asset: {
          projectId: "project-1",
          kind: "source_video",
          isPrimary: true,
          sourceType: "ai_clip",
          sourceOrigin: "ai_import",
          publicUrl: "/ai-video.mp4",
          metadata: { bytes: 900 },
        },
      }),
    ).toBeNull();

    expect(
      getSourceAssetValidationError({
        projectId: "project-1",
        sourceType: "ai_clip",
        sourceOrigin: "ai_import",
        asset: {
          projectId: "project-1",
          kind: "source_video",
          isPrimary: false,
          sourceType: "ai_clip",
          sourceOrigin: "ai_import",
          publicUrl: "/ai-video.mp4",
        },
      }),
    ).toBe("Only the active primary source can be processed for this project.");
  });

  it("collects referenced background and overlay media asset ids", () => {
    expect(
      collectReferencedMediaAssetIds({
        canvas: {
          backgroundTrack: {
            media: { assetId: "asset-bg", url: "https://example.com/bg.mp4" },
          },
        },
        layers: [
          {
            id: "overlay-1",
            timing: { start: 0, end: 1 },
            timingSource: "manual",
            content: {
              align: "start",
              theme: "dark",
              treatment: "default",
              mediaUrl: "https://example.com/overlay.mp4",
              mediaAssetId: "asset-overlay",
              playbackMode: "normal",
              blendMode: "normal",
              enterAnimation: { type: "fade", easing: "ease-out", duration: 0.45, delay: 0 },
              exitAnimation: { type: "none", easing: "ease-in-out", duration: 0.35 },
            },
          },
        ],
        sections: [],
      } as never),
    ).toEqual(["asset-bg", "asset-overlay"]);
  });

  it("rewrites referenced media urls in the manifest", () => {
    const rewritten = rewriteManifestMediaUrls(
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
          previewUrl: "/preview/demo",
        },
        publishTarget: {
          slug: "demo",
          targetType: "hosted_embed",
          version: 1,
          previewUrl: "/preview/demo",
          isReady: true,
        },
        canvas: {
          id: "canvas-root",
          presetId: "product-reveal",
          title: "Canvas",
          frameAssets: [],
          frameCount: 0,
          progressMapping: {
            startProgress: 0,
            endProgress: 1,
            frameCount: 1,
            frameRange: { start: 0, end: 1 },
          },
          backgroundTrack: {
            id: "background-track",
            start: 0,
            end: 1,
            media: {
              assetId: "asset-bg",
              url: "https://example.com/background.mp4",
            },
            endBehavior: "loop",
          },
          fallback: {
            mobileBehavior: "poster",
            reducedMotionBehavior: "poster",
          },
          motion: {
            sectionHeightVh: 240,
            scrubStrength: 1,
            easing: "linear",
            pin: true,
            preloadWindow: 4,
          },
          presetConfig: {},
          runtimeProfile: { kind: "product-reveal" },
        },
        bookmarks: [],
        layers: [
          {
            id: "overlay-1",
            timing: { start: 0, end: 1 },
            timingSource: "manual",
            content: {
              type: "image",
              mediaUrl: "https://example.com/overlay.mp4",
              mediaAssetId: "asset-overlay",
              playbackMode: "loop",
              align: "start",
              theme: "dark",
              treatment: "default",
              blendMode: "normal",
              enterAnimation: { type: "fade", easing: "ease-out", duration: 0.45, delay: 0 },
              exitAnimation: { type: "none", easing: "ease-in-out", duration: 0.35 },
            },
          },
        ],
        sections: [],
      } as never,
      new Map([
        ["asset-bg", "media/background.mp4"],
        ["asset-overlay", "media/overlay.mp4"],
      ]),
    );

    expect(rewritten.canvas.backgroundTrack?.media.url).toBe("media/background.mp4");
    expect(rewritten.layers[0]?.content.mediaUrl).toBe("media/overlay.mp4");
  });
});
