import { describe, expect, it } from "vitest";
import type { ProjectManifest } from "@motionroll/shared";
import {
  DESIGN_STAGE_HEIGHT,
  DESIGN_STAGE_WIDTH,
  getManifestSection,
  getOverlayPixelPlacement,
  hasRenderableCanvasContent,
  hasRenderableSectionContent,
} from "./runtime-preview-utils";

describe("runtime preview utils", () => {
  it("returns the first manifest section and reports renderable canvas content", () => {
    const manifest = {
      canvas: {
        backgroundTrack: {
          media: {
            url: "https://example.com/background.mp4",
          },
        },
        frameAssets: [],
        fallback: {},
      },
      layers: [],
      sections: [
        {
          id: "canvas-root",
          overlays: [],
          backgroundMedia: undefined,
          frameAssets: [],
          fallback: {},
        },
      ],
    } as ProjectManifest;

    expect(getManifestSection(manifest)?.id).toBe("canvas-root");
    expect(hasRenderableCanvasContent(manifest)).toBe(true);
    expect(hasRenderableSectionContent(manifest.sections[0])).toBe(false);
  });

  it("computes centered overlay placement from canvas dimensions", () => {
    const placement = getOverlayPixelPlacement(
      {
        content: {
          align: "center",
          layout: {
            x: 0.5,
            y: 0.5,
            width: 420,
            height: 120,
          },
        },
      } as ProjectManifest["sections"][number]["overlays"][number],
      {
        clientWidth: DESIGN_STAGE_WIDTH / 2,
        clientHeight: DESIGN_STAGE_HEIGHT / 2,
      } as HTMLElement,
      1,
    );

    expect(placement.width).toBe(420);
    expect(placement.height).toBe(120);
    expect(placement.anchorLeft).toBe(DESIGN_STAGE_WIDTH / 4);
    expect(placement.anchorTop).toBe(DESIGN_STAGE_HEIGHT / 4);
    expect(placement.left).toBe(placement.anchorLeft - placement.width / 2);
    expect(placement.top).toBe(placement.anchorTop - placement.height / 2);
  });
});
