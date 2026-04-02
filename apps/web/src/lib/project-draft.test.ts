import { describe, expect, it } from "vitest";
import {
  UnsupportedLegacyProjectDraftError,
  createProjectDraftDocument,
  parseProjectDraftDocument,
} from "./project-draft";

describe("project-draft", () => {
  it("rejects legacy scene-based drafts instead of upgrading them", () => {
    expect(() =>
      parseProjectDraftDocument({
        version: 1,
        title: "Demo",
        presetId: "product-reveal",
        sectionTitle: "Scene 01",
        sceneEnterTransition: { preset: "fade", duration: 0.4 },
        sceneExitTransition: { preset: "none", duration: 0.4 },
        sectionHeightVh: 240,
        scrubStrength: 1,
        frameRangeStart: 12,
        frameRangeEnd: 180,
        layerCount: 1,
        overlays: [],
      }),
    ).toThrow(UnsupportedLegacyProjectDraftError);
  });

  it("parses v3 canvas drafts without restoring scene aliases", () => {
    const parsed = parseProjectDraftDocument(
      createProjectDraftDocument({
        title: "Demo",
        presetId: "product-reveal",
        scrollHeightVh: 240,
        scrubStrength: 1,
        frameRange: { start: 12, end: 180 },
        bookmarkTitle: "Hero",
      }),
    );

    expect(parsed.version).toBe(3);
    expect(parsed.bookmarks).toMatchObject([{ title: "Hero", position: 0 }]);
    expect(parsed.canvas.frameRange).toEqual({ start: 12, end: 180 });
    expect(parsed).not.toHaveProperty("scenes");
    expect(parsed).not.toHaveProperty("activeSceneId");
  });
});
