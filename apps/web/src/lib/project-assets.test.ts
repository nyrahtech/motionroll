import { describe, expect, it } from "vitest";
import {
  getDerivedAssetsSnapshot,
  getPrimarySourceAsset,
  getRenderableAssetPreview,
  getSourceAssetValidationError,
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
});
