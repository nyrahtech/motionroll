/**
 * Unit tests for the frame-controller module.
 * Tests progress→frame mapping and preload window logic.
 */
import { describe, it, expect } from "vitest";
import {
  chooseFrameUrl,
  getFrameUrlForProgress,
  getSequenceRangeLocalProgress,
  isSequenceMediaVisibleAtProgress,
} from "../../modules/frame-controller";
import type { ProjectSectionManifest } from "../../../../shared/src/index";

function makeSection(
  frameCount: number,
  rangeStart = 0,
  rangeEnd?: number,
): ProjectSectionManifest {
  const end = rangeEnd ?? frameCount - 1;
  return {
    id: "test-section",
    title: "Test",
    frameCount,
    progressMapping: {
      frameRange: { start: rangeStart, end: end },
    },
    motion: { sectionHeightVh: 240, scrubStrength: 1 },
    overlays: [],
    frameAssets: Array.from({ length: frameCount }, (_, i) => ({
      index: i,
      variants: [
        { kind: "desktop", url: `https://cdn.example.com/frame-${i}.jpg` },
      ],
    })),
    fallback: { posterUrl: null, fallbackVideoUrl: null, firstFrameUrl: null },
    runtimeProfile: { kind: "scroll-sequence" as const },
  } as unknown as ProjectSectionManifest;
}

describe("chooseFrameUrl", () => {
  it("prefers desktop variant in desktop mode", () => {
    const frame = {
      index: 0,
      variants: [
        { kind: "mobile", url: "mobile.jpg" },
        { kind: "desktop", url: "desktop.jpg" },
      ],
    };
    expect(chooseFrameUrl(frame as any, "desktop")).toBe("desktop.jpg");
  });

  it("prefers mobile variant in mobile mode", () => {
    const frame = {
      index: 0,
      variants: [
        { kind: "mobile", url: "mobile.jpg" },
        { kind: "desktop", url: "desktop.jpg" },
      ],
    };
    expect(chooseFrameUrl(frame as any, "mobile")).toBe("mobile.jpg");
  });

  it("falls back to first variant if preferred kind not found", () => {
    const frame = {
      index: 0,
      variants: [{ kind: "original", url: "original.jpg" }],
    };
    expect(chooseFrameUrl(frame as any, "desktop")).toBe("original.jpg");
  });

  it("returns empty string for empty variants", () => {
    const frame = { index: 0, variants: [] };
    expect(chooseFrameUrl(frame as any, "desktop")).toBe("");
  });
});

describe("getSequenceRangeLocalProgress", () => {
  it("maps progress=0 to 0 for full-range section", () => {
    const section = makeSection(100);
    expect(getSequenceRangeLocalProgress(section, 0)).toBe(0);
  });

  it("maps progress=1 to 1 for full-range section", () => {
    const section = makeSection(100);
    expect(getSequenceRangeLocalProgress(section, 1)).toBeCloseTo(1, 2);
  });

  it("clamps out-of-range progress to [0, 1]", () => {
    const section = makeSection(100);
    expect(getSequenceRangeLocalProgress(section, -0.5)).toBe(0);
    expect(getSequenceRangeLocalProgress(section, 1.5)).toBe(1);
  });
});

describe("isSequenceMediaVisibleAtProgress", () => {
  it("returns true at progress=0 for full-range section", () => {
    const section = makeSection(100);
    expect(isSequenceMediaVisibleAtProgress(section, 0)).toBe(true);
  });

  it("returns true at midpoint", () => {
    const section = makeSection(100);
    expect(isSequenceMediaVisibleAtProgress(section, 0.5)).toBe(true);
  });

  it("returns false for progress before range start", () => {
    // Range starts at frame 50 out of 100 → progress 0.5
    const section = makeSection(100, 50);
    expect(isSequenceMediaVisibleAtProgress(section, 0.1)).toBe(false);
  });

  it("returns true for progress inside a mid-section range", () => {
    // Range: frames 25–75 out of 100
    const section = makeSection(100, 25, 75);
    expect(isSequenceMediaVisibleAtProgress(section, 0.5)).toBe(true);
  });
});

describe("getFrameUrlForProgress", () => {
  it("returns empty string for section with no frames", () => {
    const section = makeSection(0);
    (section as any).frameAssets = [];
    expect(getFrameUrlForProgress(section, "desktop", 0.5)).toBe("");
  });

  it("returns a URL at progress=0 for single-frame section", () => {
    const section = makeSection(1);
    const url = getFrameUrlForProgress(section, "desktop", 0);
    expect(url).toContain("frame-0.jpg");
  });

  it("returns last frame URL at progress=1", () => {
    const section = makeSection(5);
    const url = getFrameUrlForProgress(section, "desktop", 1);
    // Should be frame 4 (last)
    expect(url).toContain("frame-4.jpg");
  });
});
