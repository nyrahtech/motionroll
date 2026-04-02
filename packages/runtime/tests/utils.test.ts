import { describe, expect, it } from "vitest";
import { getActiveOverlayId, getFrameByIndex, getOverlaysInStackOrder, progressToFrameIndex } from "../src/utils";

const defaultEnterAnimation = {
  type: "none" as const,
  easing: "ease-out" as const,
  duration: 0.4,
  delay: 0,
};

const defaultExitAnimation = {
  type: "none" as const,
  easing: "ease-in-out" as const,
  duration: 0.3,
};

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
            timingSource: "manual",
            content: {
              text: "Intro\n\nIntro body",
              align: "start",
              theme: "light",
              treatment: "default",
              blendMode: "normal",
              enterAnimation: defaultEnterAnimation,
              exitAnimation: defaultExitAnimation,
            },
          },
          {
            id: "detail",
            timing: { start: 0.4, end: 0.6 },
            timingSource: "manual",
            content: {
              text: "Detail\n\nDetail body",
              align: "end",
              theme: "dark",
              treatment: "default",
              blendMode: "normal",
              enterAnimation: defaultEnterAnimation,
              exitAnimation: defaultExitAnimation,
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
            timingSource: "manual",
            content: {
              text: "Headline\n\nBody",
              align: "start",
              theme: "light",
              treatment: "default",
              blendMode: "normal",
              layer: 0,
              enterAnimation: defaultEnterAnimation,
              exitAnimation: defaultExitAnimation,
            },
          },
          {
            id: "cta",
            timing: { start: 0.55, end: 0.85 },
            timingSource: "manual",
            content: {
              text: "CTA\n\nCTA body",
              align: "end",
              theme: "dark",
              treatment: "default",
              blendMode: "normal",
              layer: 1,
              enterAnimation: defaultEnterAnimation,
              exitAnimation: defaultExitAnimation,
            },
          },
        ],
        0.6,
      ),
    ).toBe("cta");
  });

  it("prefers the highest layer when overlapping overlays are both active", () => {
    expect(
      getActiveOverlayId(
        [
          {
            id: "bottom",
            timing: { start: 0.2, end: 0.8 },
            timingSource: "manual",
            content: {
              text: "Bottom\n\nBody",
              align: "start",
              theme: "light",
              treatment: "default",
              blendMode: "normal",
              layer: 0,
              enterAnimation: defaultEnterAnimation,
              exitAnimation: defaultExitAnimation,
            },
          },
          {
            id: "top",
            timing: { start: 0.2, end: 0.8 },
            timingSource: "manual",
            content: {
              text: "Top\n\nBody",
              align: "start",
              theme: "dark",
              treatment: "default",
              blendMode: "normal",
              layer: 1,
              enterAnimation: defaultEnterAnimation,
              exitAnimation: defaultExitAnimation,
            },
          },
        ],
        0.5,
      ),
    ).toBe("top");
  });
});

describe("getOverlaysInStackOrder", () => {
  it("orders overlays from back to front using explicit layer values", () => {
    expect(getOverlaysInStackOrder([
      {
        id: "top",
        timing: { start: 0, end: 1 },
        timingSource: "manual",
        content: {
          text: "Top\n\nBody",
          align: "start",
          theme: "light",
          treatment: "default",
          blendMode: "normal",
          layer: 3,
          enterAnimation: defaultEnterAnimation,
          exitAnimation: defaultExitAnimation,
        },
      },
      {
        id: "bottom",
        timing: { start: 0, end: 1 },
        timingSource: "manual",
        content: {
          text: "Bottom\n\nBody",
          align: "start",
          theme: "dark",
          treatment: "default",
          blendMode: "normal",
          layer: 0,
          enterAnimation: defaultEnterAnimation,
          exitAnimation: defaultExitAnimation,
        },
      },
    ]).map((overlay) => overlay.id)).toEqual(["bottom", "top"]);
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
