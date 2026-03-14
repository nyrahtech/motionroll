import { describe, expect, it } from "vitest";
import {
  getVelocityAwareSmoothing,
  stepSequenceProgress,
  wheelDeltaToProgressDelta,
} from "../src/sequence";

describe("sequence helpers", () => {
  it("uses stronger smoothing when delta magnitude is larger", () => {
    expect(getVelocityAwareSmoothing(0.2)).toBe(0.25);
    expect(getVelocityAwareSmoothing(0.1)).toBe(0.19);
    expect(getVelocityAwareSmoothing(0.04)).toBe(0.14);
    expect(getVelocityAwareSmoothing(0.01)).toBe(0.1);
  });

  it("steps current progress toward target progress and settles cleanly", () => {
    expect(
      stepSequenceProgress({
        currentProgress: 0,
        targetProgress: 0.5,
      }),
    ).toBeGreaterThan(0);

    expect(
      stepSequenceProgress({
        currentProgress: 0.4999,
        targetProgress: 0.5,
      }),
    ).toBe(0.5);
  });

  it("converts wheel delta into normalized progress delta using the shared scroll distance", () => {
    expect(wheelDeltaToProgressDelta(640)).toBe(0.1);
    expect(wheelDeltaToProgressDelta(-320)).toBe(-0.05);
  });
});
