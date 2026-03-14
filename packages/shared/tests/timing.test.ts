import { describe, expect, it } from "vitest";
import {
  frameIndexToSequenceProgress,
  progressToFrameBoundaryIndex,
  progressToFrameIndex,
  progressToSeconds,
  secondsToProgress,
} from "../src";

describe("shared timing helpers", () => {
  it("maps progress to an inclusive frame range deterministically", () => {
    expect(progressToFrameIndex(0, { start: 10, end: 19 })).toBe(10);
    expect(progressToFrameIndex(0.5, { start: 10, end: 19 })).toBe(15);
    expect(progressToFrameIndex(1, { start: 10, end: 19 })).toBe(19);
  });

  it("round-trips sequence boundaries through frame count helpers", () => {
    expect(frameIndexToSequenceProgress(0, 180)).toBe(0);
    expect(frameIndexToSequenceProgress(179, 180)).toBe(1);
    expect(progressToFrameBoundaryIndex(1, 180)).toBe(179);
  });

  it("maps playhead progress and seconds consistently", () => {
    expect(progressToSeconds(0.25, 12)).toBe(3);
    expect(secondsToProgress(3, 12)).toBe(0.25);
  });
});
