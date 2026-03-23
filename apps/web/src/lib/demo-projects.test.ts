import { describe, expect, it } from "vitest";
import { progressToFrameIndex } from "@motionroll/shared";
import { demoProjectSeeds } from "./demo-projects";

describe("demo project seeds", () => {
  const motionrollDemo = demoProjectSeeds[0];

  it("puts the MotionRoll demo first so it becomes the default editor target", () => {
    expect(motionrollDemo?.slug).toBe("demo-motionroll-editor");
    expect(motionrollDemo?.title).toBe("MotionRoll Demo");
    expect(motionrollDemo?.presetId).toBe("scroll-sequence");
    expect(motionrollDemo?.sourceVideoUrl).toBe("/motionroll_demo_sequence/demo.mp4");
    expect(motionrollDemo?.fallbackBehavior).toEqual({
      mobile: "sequence",
      reducedMotion: "sequence",
    });
  });

  it("stores committed demo assets for the MotionRoll demo", () => {
    expect(motionrollDemo?.posterUrl).toBe("/motionroll_demo_sequence/poster.webp");
    expect(motionrollDemo?.fallbackVideoUrl).toBe("/motionroll_demo_sequence/demo.mp4");
    expect(motionrollDemo?.frameUrls).toHaveLength(motionrollDemo?.frameCount ?? 0);
    expect(motionrollDemo?.frameRangeEnd).toBe((motionrollDemo?.frameCount ?? 1) - 1);
  });

  it("maps MotionRoll demo progress values to the expected first, middle, and last derived frames", () => {
    const frameRange = {
      start: 0,
      end: motionrollDemo?.frameRangeEnd ?? 0,
    };

    expect(progressToFrameIndex(0, frameRange)).toBe(0);
    expect(progressToFrameIndex(0.5, frameRange)).toBe(23);
    expect(progressToFrameIndex(1, frameRange)).toBe(46);
  });
});
