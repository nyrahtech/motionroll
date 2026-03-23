import { describe, expect, it } from "vitest";
import {
  clampScale,
  overlayToBox,
  unionBoxes,
} from "./overlay-manipulator-utils";
import type { Box } from "./overlay-manipulator-utils";

describe("clampScale", () => {
  it("clamps to min 0.5", () => {
    expect(clampScale(0.01)).toBeCloseTo(0.5);
  });
  it("clamps to max 3", () => {
    expect(clampScale(20)).toBeCloseTo(3);
  });
  it("passes through values in range", () => {
    expect(clampScale(1.5)).toBeCloseTo(1.5);
  });
});

describe("unionBoxes", () => {
  it("returns null for empty array", () => {
    expect(unionBoxes([])).toBeNull();
  });

  it("returns single box unchanged", () => {
    const box: Box = { left: 10, top: 20, width: 100, height: 80 };
    expect(unionBoxes([box])).toEqual(box);
  });

  it("computes bounding box of two non-overlapping boxes", () => {
    const a: Box = { left: 0, top: 0, width: 80, height: 80 };
    const b: Box = { left: 100, top: 100, width: 80, height: 80 };
    const union = unionBoxes([a, b])!;
    expect(union.left).toBe(0);
    expect(union.top).toBe(0);
    expect(union.width).toBe(180);
    expect(union.height).toBe(180);
  });

  it("handles overlapping boxes", () => {
    const a: Box = { left: 10, top: 10, width: 80, height: 80 };
    const b: Box = { left: 50, top: 50, width: 80, height: 80 };
    const union = unionBoxes([a, b])!;
    expect(union.left).toBe(10);
    expect(union.top).toBe(10);
    expect(union.width).toBe(120); // 10 to 130
    expect(union.height).toBe(120);
  });
});
