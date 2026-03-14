import { describe, expect, it } from "vitest";
import { getActiveOverlayId, getFrameByIndex, progressToFrameIndex } from "../src/utils";

describe("progressToFrameIndex", () => {
  it("maps progress to the configured frame range", () => {
    expect(progressToFrameIndex(0, { start: 10, end: 19 })).toBe(10);
    expect(progressToFrameIndex(0.5, { start: 10, end: 19 })).toBe(15);
    expect(progressToFrameIndex(1, { start: 10, end: 19 })).toBe(19);
  });
});

describe("getActiveOverlayId", () => {
  it("returns the overlay active at the current progress", () => {
    expect(
      getActiveOverlayId(
        [
          {
            id: "intro",
            timing: { start: 0, end: 0.2 },
            content: {
              headline: "Intro",
              body: "Intro body",
              align: "start",
              theme: "light",
              treatment: "default",
            },
          },
          {
            id: "detail",
            timing: { start: 0.4, end: 0.6 },
            content: {
              headline: "Detail",
              body: "Detail body",
              align: "end",
              theme: "dark",
              treatment: "default",
            },
          },
        ],
        0.45,
      ),
    ).toBe("detail");
  });

  it("prefers the most recent matching overlay when timings overlap", () => {
    expect(
      getActiveOverlayId(
        [
          {
            id: "headline",
            timing: { start: 0.2, end: 0.7 },
            content: {
              headline: "Headline",
              body: "Body",
              align: "start",
              theme: "light",
              treatment: "default",
            },
          },
          {
            id: "cta",
            timing: { start: 0.55, end: 0.85 },
            content: {
              headline: "CTA",
              body: "CTA body",
              align: "end",
              theme: "dark",
              treatment: "default",
            },
          },
        ],
        0.6,
      ),
    ).toBe("cta");
  });
});

describe("getFrameByIndex", () => {
  it("returns the nearest available frame when indexes are sparse", () => {
    expect(
      getFrameByIndex(
        [
          { index: 0, path: "frame-0", variants: [] },
          { index: 4, path: "frame-4", variants: [] },
        ],
        2,
      )?.index,
    ).toBe(4);
  });
});
