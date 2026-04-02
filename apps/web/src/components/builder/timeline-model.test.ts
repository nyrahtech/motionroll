import { describe, expect, it } from "vitest";
import {
  getFrameRangeFromClip,
  getTimelineFrameStripForProgressRange,
  getTimelineProgressFromPointer,
  getTimelineStepProgress,
  getTimelineTimeLabel,
  getTimelineZoomWidth,
  moveTimelineClip,
  resizeTimelineClip,
  snapTimelineValue,
  type TimelineFrameStripSource,
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

  it("formats timeline labels and stable step sizes", () => {
    expect(getTimelineTimeLabel(0.5, 10)).toBe("00:05");
    expect(getTimelineZoomWidth(640, 12, 2)).toBeGreaterThan(getTimelineZoomWidth(640, 12, 1));
    expect(getTimelineStepProgress(10)).toBeGreaterThan(0);
  });

  it("maps a trimmed sequence span back to inclusive frame indices", () => {
    expect(getFrameRangeFromClip({ start: 0.1, end: 0.5 }, 100)).toEqual({
      start: 10,
      end: 50,
    });
  });

  it("samples frame strips across a progress range", () => {
    const frameSource: TimelineFrameStripSource = {
      frameCount: 12,
      frames: [
        { index: 0, url: "/frame-0.png" },
        { index: 3, url: "/frame-3.png" },
        { index: 6, url: "/frame-6.png" },
        { index: 9, url: "/frame-9.png" },
      ],
      fallbackUrl: "/poster.png",
    };

    expect(getTimelineFrameStripForProgressRange(frameSource, 0, 1, 4)).toEqual([
      "/frame-0.png",
      "/frame-6.png",
      "/frame-9.png",
      "/frame-9.png",
    ]);
  });
});
