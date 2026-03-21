import { describe, expect, it } from "vitest";
import { buildPublishReadinessChecks, summarizePublishReadiness } from "./readiness";

describe("publish readiness", () => {
  it("blocks publish when required assets are missing", () => {
    const checks = buildPublishReadinessChecks({
      selectedPreset: "product-reveal",
      sections: [
        {
          title: "Hero",
          commonConfig: {
            frameRange: { start: 0, end: 10 },
            fallbackBehavior: {
              mobile: "video",
              reducedMotion: "poster",
            },
            text: {
              content: "Hello\n\nWorld",
            },
          },
        },
      ],
      assets: [],
      jobs: [],
      failureReason: null,
    });
    const summary = summarizePublishReadiness(checks);

    expect(summary.ready).toBe(false);
    expect(summary.blockedCount).toBeGreaterThan(0);
  });

  it("marks publish ready when poster plus frames are enough for an optional-video preset", () => {
    const summary = summarizePublishReadiness(
      buildPublishReadinessChecks({
        selectedPreset: "device-spin",
        sections: [
          {
            title: "Hero",
            commonConfig: {
              frameRange: { start: 0, end: 179 },
              fallbackBehavior: {
                mobile: "poster",
                reducedMotion: "poster",
              },
              text: {
                content: "Hello\n\nWorld",
              },
            },
          },
        ],
        assets: [
          { kind: "frame_sequence", sourceOrigin: "upload" },
          { kind: "frame", sourceOrigin: "upload" },
          { kind: "poster", sourceOrigin: "upload" },
        ],
        jobs: [{ status: "completed", failureReason: null }],
        failureReason: null,
      }),
    );

    expect(summary.ready).toBe(true);
    expect(summary.blockedCount).toBe(0);
  });
});
