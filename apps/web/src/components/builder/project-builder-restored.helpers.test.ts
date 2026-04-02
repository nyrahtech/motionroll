import { describe, expect, it } from "vitest";
import type { ProjectManifest } from "@motionroll/shared";
import { createProjectDraftDocument } from "../../lib/project-draft";
import {
  MIN_LAYER_SPAN,
  buildPreviewManifest,
  buildTimelineSelection,
  createTextLayer,
  normalizeDraftDocument,
} from "./project-builder-restored.helpers";

describe("project builder restored helpers", () => {
  it("normalizes draft bookmarks, layers, and canvas bounds", () => {
    const draft = createProjectDraftDocument({
      title: "Test Project",
      presetId: "scroll-sequence",
      scrollHeightVh: 240,
      scrubStrength: 1,
      frameRange: { start: 0, end: 191 },
    });

    const normalized = normalizeDraftDocument({
      ...draft,
      bookmarks: [],
      canvas: {
        ...draft.canvas,
        scrollHeightVh: 999,
        scrubStrength: 9,
        frameRange: { start: 32, end: 32 },
      },
      layers: [
        {
          ...createTextLayer(0.92, 7),
          timing: { start: 0.96, end: 0.961 },
        },
      ],
    });

    expect(normalized.bookmarks).toHaveLength(1);
    expect(normalized.bookmarks[0]?.title).toBe("Section 1");
    expect(normalized.canvas.scrollHeightVh).toBe(600);
    expect(normalized.canvas.scrubStrength).toBe(4);
    expect(normalized.canvas.frameRange).toEqual({ start: 32, end: 33 });
    expect(normalized.layers[0]?.content.layer).toBe(0);
    expect((normalized.layers[0]?.timing.end ?? 0) - (normalized.layers[0]?.timing.start ?? 0)).toBeGreaterThanOrEqual(
      MIN_LAYER_SPAN,
    );
  });

  it("builds preview manifests from the normalized single-canvas draft", () => {
    const draft = normalizeDraftDocument({
      ...createProjectDraftDocument({
        title: "Story",
        presetId: "scroll-sequence",
        scrollHeightVh: 220,
        scrubStrength: 1,
        frameRange: { start: 0, end: 191 },
        layers: [createTextLayer(0.2, 0)],
      }),
      bookmarks: [
        { id: "bookmark-2", title: "CTA", position: 0.8 },
        { id: "bookmark-1", title: "Hero", position: 0 },
      ],
      canvas: {
        id: "canvas-root",
        scrollHeightVh: 220,
        scrubStrength: 1,
        frameRange: { start: 0, end: 191 },
        backgroundColor: "#101114",
        backgroundTrack: {
          id: "background-track",
          start: 0,
          end: 1,
          media: {
            url: "https://example.com/background.mp4",
            previewUrl: "https://example.com/background-preview.mp4",
          },
          endBehavior: "loop",
        },
      },
    });

    const baseManifest = {
      project: { title: "Story" },
      selectedPreset: "scroll-sequence",
      generatedAt: "2026-03-31T00:00:00.000Z",
      canvas: {
        id: "canvas-root",
        presetId: "scroll-sequence",
        title: "Story",
        frameCount: 192,
        frameAssets: [],
        progressMapping: { frameCount: 192, frameRange: { start: 0, end: 191 } },
        backgroundColor: "#000000",
        fallback: {},
        motion: { sectionHeightVh: 220, scrubStrength: 1 },
        presetConfig: {},
        runtimeProfile: "default",
      },
      bookmarks: [],
      layers: [],
      sections: [
        {
          id: "canvas-root",
          presetId: "scroll-sequence",
          title: "Story",
          frameAssets: [],
          frameCount: 192,
          progressMapping: { frameCount: 192, frameRange: { start: 0, end: 191 } },
          overlays: [],
          moments: [],
          transitions: [],
          fallback: {},
          motion: { sectionHeightVh: 220, scrubStrength: 1 },
          presetConfig: {},
          runtimeProfile: "default",
        },
      ],
    } as ProjectManifest;

    const previewManifest = buildPreviewManifest(baseManifest, draft);

    expect(previewManifest.project.title).toBe("Story");
    expect(previewManifest.bookmarks.map((bookmark) => bookmark.id)).toEqual([
      "bookmark-1",
      "bookmark-2",
    ]);
    expect(previewManifest.layers).toHaveLength(1);
    expect(previewManifest.canvas.backgroundTrack?.media.url).toBe("https://example.com/background.mp4");
    expect(previewManifest.sections[0]?.backgroundMedia?.url).toBe("https://example.com/background.mp4");
  });

  it("builds timeline selections for global layers and bookmarks", () => {
    expect(buildTimelineSelection("layer-7", "")).toEqual({
      clipId: "layer-7",
      trackType: "layer",
    });
    expect(buildTimelineSelection("", "bookmark-2")).toEqual({
      clipId: "bookmark-bookmark-2",
      trackType: "section",
    });
    expect(buildTimelineSelection("", "")).toBeNull();
  });
});
