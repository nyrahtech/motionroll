import { describe, expect, it } from "vitest";
import { getClipInsertionIndex, getLayerDragGhostPosition, resolveLayerTrackIndexFromPointer } from "./timeline-drag-preview";

describe("timeline drag preview helpers", () => {
  it("prefers the row directly under the pointer", () => {
    expect(resolveLayerTrackIndexFromPointer(122, [
      { trackIndex: 0, top: 40, bottom: 100, height: 60 },
      { trackIndex: 1, top: 101, bottom: 161, height: 60 },
      { trackIndex: 2, top: 162, bottom: 222, height: 60 },
    ])).toBe(1);
  });

  it("falls back to the nearest visible layer row near boundaries", () => {
    expect(resolveLayerTrackIndexFromPointer(158, [
      { trackIndex: 0, top: 40, bottom: 100, height: 60 },
      { trackIndex: 1, top: 101, bottom: 141, height: 40 },
      { trackIndex: 2, top: 181, bottom: 221, height: 40 },
    ])).toBe(1);

    expect(resolveLayerTrackIndexFromPointer(176, [
      { trackIndex: 0, top: 40, bottom: 100, height: 60 },
      { trackIndex: 1, top: 101, bottom: 141, height: 40 },
      { trackIndex: 2, top: 181, bottom: 221, height: 40 },
    ])).toBe(2);
  });

  it("computes insertion order from the target time while ignoring the dragged clip", () => {
    expect(getClipInsertionIndex(0.42, [
      { id: "dragged", start: 0.18 },
      { id: "intro", start: 0.1 },
      { id: "cta", start: 0.64 },
      { id: "badge", start: 0.35 },
    ], "dragged")).toBe(2);
  });

  it("maps the layer ghost into timeline-local coordinates and clamps it to the visible bounds", () => {
    expect(getLayerDragGhostPosition({
      clientX: 310,
      clientY: 190,
      containerRect: { left: 100, top: 40, width: 320, height: 180 },
      scrollLeft: 48,
      scrollTop: 24,
      pointerOffsetX: 36,
      pointerOffsetY: 18,
      ghostWidth: 280,
      ghostHeight: 56,
    })).toEqual({
      left: 88,
      top: 148,
    });

    expect(getLayerDragGhostPosition({
      clientX: 30,
      clientY: 10,
      containerRect: { left: 100, top: 40, width: 320, height: 180 },
      scrollLeft: 48,
      scrollTop: 24,
      pointerOffsetX: 36,
      pointerOffsetY: 18,
      ghostWidth: 280,
      ghostHeight: 56,
    })).toEqual({
      left: 48,
      top: 24,
    });
  });
});
