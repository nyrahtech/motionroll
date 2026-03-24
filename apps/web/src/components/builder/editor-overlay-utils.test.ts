import { describe, expect, it } from "vitest";
import {
  buildOverlayId,
  isGroupOverlay,
  getRootOverlays,
  getTopLayerIndex,
  getRequiredLayerCount,
  getOverlayById,
  getDirectGroupChildren,
  getRootOverlayId,
  normalizeOverlayLayers,
  getSceneRangeTiming,
  getSceneBoundOverlayTiming,
  scaleSceneRangeOverlays,
  duplicateRootOverlays,
  deleteRootOverlays,
  reorderOverlayLayers,
  getGroupSelectionEligibility,
} from "./editor-overlay-utils";
import type { HydratedOverlayDefinition } from "./editor-draft-types";

function makeOverlay(
  id: string,
  layer = 0,
  parentGroupId?: string,
): HydratedOverlayDefinition {
  return {
    id,
    timing: { start: 0, end: 1 },
    timingSource: "manual",
    content: {
      type: "text",
      text: id,
      align: "start",
      theme: "dark",
      treatment: "default",
      layer,
      parentGroupId,
      style: { fontFamily: "Inter", fontSize: 34, fontWeight: 600, color: "#fff", lineHeight: 1.08,
               letterSpacing: 0, textAlign: "start", opacity: 1, maxWidth: 420,
               italic: false, underline: false, textTransform: "none", buttonLike: false },
      background: { enabled: false, mode: "transparent", color: "#000", opacity: 0,
                    radius: 14, paddingX: 18, paddingY: 14, borderColor: "#fff", borderOpacity: 0 },
      enterAnimation: { type: "fade", easing: "ease-out", duration: 0.45, delay: 0 },
      exitAnimation: { type: "none", easing: "ease-in-out", duration: 0.35 },
      layout: { x: 0.08, y: 0.12, width: 420 },
    },
  };
}

function makeGroup(id: string, layer = 0): HydratedOverlayDefinition {
  return {
    ...makeOverlay(id, layer),
    content: { ...makeOverlay(id, layer).content, type: "group" },
  };
}

describe("buildOverlayId", () => {
  it("generates a unique id with the given prefix", () => {
    const a = buildOverlayId("text");
    const b = buildOverlayId("text");
    expect(a).toMatch(/^text-/);
    expect(b).toMatch(/^text-/);
    expect(a).not.toBe(b);
  });
});

describe("isGroupOverlay", () => {
  it("returns true for group type", () => {
    expect(isGroupOverlay(makeGroup("g1"))).toBe(true);
  });
  it("returns false for text type", () => {
    expect(isGroupOverlay(makeOverlay("t1"))).toBe(false);
  });
});

describe("getRootOverlays", () => {
  it("filters out child overlays", () => {
    const overlays = [
      makeOverlay("root"),
      makeOverlay("child", 0, "root"),
    ];
    const roots = getRootOverlays(overlays);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.id).toBe("root");
  });
});

describe("getTopLayerIndex", () => {
  it("returns the highest layer index of root overlays", () => {
    const overlays = [
      makeOverlay("a", 0),
      makeOverlay("b", 2),
      makeOverlay("c", 1),
      makeOverlay("child", 0, "a"), // children excluded from max
    ];
    expect(getTopLayerIndex(overlays)).toBe(2);
  });

  it("returns -1 for empty array", () => {
    expect(getTopLayerIndex([])).toBe(-1);
  });
});

describe("getRequiredLayerCount", () => {
  it("returns at least current count", () => {
    const overlays = [makeOverlay("a", 0)];
    expect(getRequiredLayerCount(overlays, 3)).toBe(3);
  });

  it("returns max layer + 1 when higher than current", () => {
    const overlays = [makeOverlay("a", 4)];
    expect(getRequiredLayerCount(overlays, 2)).toBe(5);
  });
});

describe("getOverlayById", () => {
  it("finds overlay by id", () => {
    const overlays = [makeOverlay("a"), makeOverlay("b")];
    expect(getOverlayById(overlays, "b")!.id).toBe("b");
  });

  it("returns undefined for missing id", () => {
    expect(getOverlayById([makeOverlay("a")], "z")).toBeUndefined();
  });
});

describe("getDirectGroupChildren", () => {
  it("returns only immediate children", () => {
    const overlays = [
      makeGroup("g"),
      makeOverlay("c1", 0, "g"),
      makeOverlay("c2", 0, "g"),
      makeOverlay("unrelated"),
    ];
    const children = getDirectGroupChildren(overlays, "g");
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });
});

describe("getRootOverlayId", () => {
  it("returns the group id for a child overlay", () => {
    const overlays = [makeGroup("g"), makeOverlay("child", 0, "g")];
    expect(getRootOverlayId(overlays, "child")).toBe("g");
  });

  it("returns self id for a root overlay", () => {
    const overlays = [makeOverlay("root")];
    expect(getRootOverlayId(overlays, "root")).toBe("root");
  });
});

describe("normalizeOverlayLayers", () => {
  it("reassigns layers starting from 0 preserving relative order", () => {
    const overlays = [
      makeOverlay("a", 3),
      makeOverlay("b", 7),
      makeOverlay("c", 0),
    ];
    const normalized = normalizeOverlayLayers(overlays);
    const layers = normalized.map((o) => o.content.layer ?? 0);
    expect(Math.min(...layers)).toBe(0);
    expect(new Set(layers).size).toBe(layers.length);
  });
});

describe("duplicateRootOverlays", () => {
  it("inserts duplicate after the source overlay", () => {
    const overlays = [makeOverlay("a"), makeOverlay("b")];
    const { overlays: result, duplicateIds } = duplicateRootOverlays(overlays, ["a"]);
    expect(duplicateIds).toHaveLength(1);
    const sourceIdx = result.findIndex((o) => o.id === "a");
    const dupIdx = result.findIndex((o) => o.id === duplicateIds[0]);
    expect(dupIdx).toBe(sourceIdx + 1);
  });

  it("duplicates group and its children", () => {
    const overlays = [
      makeGroup("g"),
      makeOverlay("child", 0, "g"),
    ];
    const { overlays: result, duplicateIds } = duplicateRootOverlays(overlays, ["g"]);
    expect(duplicateIds).toHaveLength(1);
    const dupGroupId = duplicateIds[0]!;
    const dupChildren = result.filter((o) => o.content.parentGroupId === dupGroupId);
    expect(dupChildren).toHaveLength(1);
  });
});

describe("scene range timing", () => {
  it("derives overlay timing from the scene frame range", () => {
    const timing = getSceneRangeTiming(24, 72, 96);
    expect(timing.start).toBeCloseTo(24 / 95, 5);
    expect(timing.end).toBeCloseTo(72 / 95, 5);
  });

  it("creates a bounded default timing window around the playhead", () => {
    const timing = getSceneBoundOverlayTiming(0.52, { start: 0.2, end: 0.8 });
    expect(timing.start).toBeGreaterThanOrEqual(0.2);
    expect(timing.end).toBeLessThanOrEqual(0.8);
    expect(timing.end - timing.start).toBeGreaterThan(0);
    expect(timing.end - timing.start).toBeLessThan(0.8 - 0.2);
  });

  it("scales block lifetimes when the scene frame range changes", () => {
    const overlays = [
      { ...makeOverlay("scene"), timing: { start: 0.3, end: 0.45 } },
      { ...makeOverlay("manual"), timingSource: "manual" as const, timing: { start: 0.2, end: 0.4 } },
    ];

    const synced = scaleSceneRangeOverlays(overlays, 10, 30, 5, 35, 40);

    expect(synced[0]?.timing.start).toBeCloseTo(0.1936, 3);
    expect(synced[0]?.timing.end).toBeCloseTo(0.4186, 3);
    expect(synced[1]?.timing.start).toBeCloseTo(0.1282, 3);
    expect(synced[1]?.timing.end).toBeCloseTo(0.3436, 3);
  });
});

describe("deleteRootOverlays", () => {
  it("removes overlay and its children", () => {
    const overlays = [
      makeGroup("g"),
      makeOverlay("child", 0, "g"),
      makeOverlay("other"),
    ];
    const result = deleteRootOverlays(overlays, ["g"]);
    expect(result.some((o) => o.id === "g")).toBe(false);
    expect(result.some((o) => o.id === "child")).toBe(false);
    expect(result.some((o) => o.id === "other")).toBe(true);
  });
});

describe("reorderOverlayLayers", () => {
  it("moves a layer from one row position to another", () => {
    // 2 layers: layer index 0 = bottom (row 1), layer index 1 = top (row 0)
    const overlays = [makeOverlay("a", 0), makeOverlay("b", 1)];
    // Move the top row (row 0, layer 1) down to row 1 (layer 0)
    const result = reorderOverlayLayers(overlays, 2, 0, 1);
    // After reorder, overlays should still have valid layer indices
    expect(result.every((o) => typeof (o.content.layer ?? 0) === "number")).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("returns overlays unchanged for out-of-range fromRow", () => {
    const overlays = [makeOverlay("a", 0)];
    const result = reorderOverlayLayers(overlays, 1, 5, 0);
    expect(result[0]!.content.layer).toBe(0);
  });
});

describe("getGroupSelectionEligibility", () => {
  it("returns true for multiple ungrouped root overlays", () => {
    const overlays = [makeOverlay("a", 0), makeOverlay("b", 1)];
    expect(getGroupSelectionEligibility(overlays, ["a", "b"])).toBe(true);
  });

  it("returns false when selection includes a group overlay", () => {
    const overlays = [makeGroup("g"), makeOverlay("a", 1)];
    expect(getGroupSelectionEligibility(overlays, ["g", "a"])).toBe(false);
  });

  it("returns false for single-item selection", () => {
    const overlays = [makeOverlay("a", 0)];
    expect(getGroupSelectionEligibility(overlays, ["a"])).toBe(false);
  });

  it("returns false when overlay is a group child", () => {
    const overlays = [makeGroup("g"), makeOverlay("a", 0, "g"), makeOverlay("b", 1)];
    expect(getGroupSelectionEligibility(overlays, ["a", "b"])).toBe(false);
  });
});
