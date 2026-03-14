import { describe, expect, it } from "vitest";
import { getPresetFallbackPolicy, resolveFallbackStrategy } from "../src";

describe("resolveFallbackStrategy", () => {
  it("prefers sequence when requested and frames are available", () => {
    expect(
      resolveFallbackStrategy({
        requestedBehavior: "sequence",
        hasFrames: true,
        hasPoster: true,
        hasFallbackVideo: true,
      }),
    ).toBe("sequence");
  });

  it("falls back to poster when a requested video is missing", () => {
    expect(
      resolveFallbackStrategy({
        requestedBehavior: "video",
        hasFrames: true,
        hasPoster: true,
        hasFallbackVideo: false,
      }),
    ).toBe("poster");
  });

  it("uses the first frame when poster and video are unavailable", () => {
    expect(
      resolveFallbackStrategy({
        requestedBehavior: "poster",
        hasFrames: true,
        hasPoster: false,
        hasFallbackVideo: false,
      }),
    ).toBe("first-frame");
  });
});

describe("getPresetFallbackPolicy", () => {
  it("marks fallback video as optional for device spins", () => {
    expect(getPresetFallbackPolicy("device-spin").videoRequirement).toBe("optional");
  });
});
