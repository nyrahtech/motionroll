/**
 * Tests for useSelectionMutations — multi-select move/duplicate/delete
 * and the updateSelectedOverlay helper.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import { useSelectionMutations } from "../useSelectionMutations";
import type { EditorDraft, HydratedOverlayDefinition } from "../../editor-draft-types";

function makeOverlay(
  id: string,
  x = 0.1,
  y = 0.1,
  layer = 0,
  parentGroupId?: string,
): HydratedOverlayDefinition {
  return {
    id,
    timing: { start: 0, end: 1 },
    content: {
      type: "text",
      text: id,
      align: "start",
      theme: "dark",
      treatment: "default",
      layer,
      parentGroupId,
      layout: { x, y, width: 300 },
      style: {
        fontFamily: "Inter", fontSize: 34, fontWeight: 600, color: "#fff", lineHeight: 1.08,
        letterSpacing: 0, textAlign: "start", opacity: 1, maxWidth: 300,
        italic: false, underline: false, textTransform: "none", buttonLike: false,
      },
      background: {
        enabled: false, mode: "transparent", color: "#000", opacity: 0,
        radius: 14, paddingX: 18, paddingY: 14, borderColor: "#fff", borderOpacity: 0,
      },
      animation: { preset: "fade", easing: "ease-out", duration: 0.45, delay: 0 },
      transition: { preset: "crossfade", easing: "ease-in-out", duration: 0.4 },
    },
  };
}

function makeDraft(overlays: HydratedOverlayDefinition[] = []): EditorDraft {
  return {
    title: "Test",
    presetId: "product-reveal" as const,
    sectionTitle: "Scene 01",
    sectionHeightVh: 240,
    scrubStrength: 1,
    frameRangeStart: 0,
    frameRangeEnd: 180,
    layerCount: 2,
    overlays,
  };
}

describe("useSelectionMutations", () => {
  let draft: EditorDraft;
  let draftRef: React.MutableRefObject<EditorDraft>;
  let updateDraft: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    draft = makeDraft([makeOverlay("a", 0.1, 0.1), makeOverlay("b", 0.5, 0.5)]);
    draftRef = { current: draft };
    updateDraft = vi.fn((transform) => {
      draft = transform(draft);
      draftRef.current = draft;
    });
  });

  function render() {
    return renderHook(() =>
      useSelectionMutations({ updateDraft, draftRef }),
    );
  }

  // ── handleMoveSelection ─────────────────────────────────────────────────

  describe("handleMoveSelection", () => {
    it("shifts x/y of all selected overlays by delta", () => {
      const { result } = render();
      act(() => {
        result.current.handleMoveSelection({ x: 0.1, y: 0.05 }, ["a", "b"]);
      });
      expect(updateDraft).toHaveBeenCalledOnce();
      const overlay_a = draft.overlays.find((o) => o.id === "a")!;
      expect(overlay_a.content.layout?.x).toBeCloseTo(0.2);
      expect(overlay_a.content.layout?.y).toBeCloseTo(0.15);
    });

    it("does nothing when fewer than 2 overlays are selected", () => {
      const { result } = render();
      act(() => {
        result.current.handleMoveSelection({ x: 0.1, y: 0.1 }, ["a"]);
      });
      expect(updateDraft).not.toHaveBeenCalled();
    });
  });

  // ── handleDuplicateSelection ────────────────────────────────────────────

  describe("handleDuplicateSelection", () => {
    it("duplicates a single overlay when multi-selection is empty", () => {
      const { result } = render();
      let res: { duplicateIds: string[] } = { duplicateIds: [] };
      act(() => {
        res = result.current.handleDuplicateSelection([], "a");
      });
      expect(res.duplicateIds).toHaveLength(1);
      expect(draft.overlays).toHaveLength(3);
    });

    it("duplicates multiple selected overlays", () => {
      const { result } = render();
      let res: { duplicateIds: string[] } = { duplicateIds: [] };
      act(() => {
        res = result.current.handleDuplicateSelection(["a", "b"], "a");
      });
      expect(res.duplicateIds).toHaveLength(2);
      expect(draft.overlays).toHaveLength(4);
    });

    it("returns empty when no overlay selected", () => {
      const { result } = render();
      let res: { duplicateIds: string[] } = { duplicateIds: [] };
      act(() => {
        res = result.current.handleDuplicateSelection([], "");
      });
      expect(res.duplicateIds).toHaveLength(0);
      expect(updateDraft).not.toHaveBeenCalled();
    });
  });

  // ── handleDeleteSelection ───────────────────────────────────────────────

  describe("handleDeleteSelection", () => {
    it("removes the single selected overlay", () => {
      const { result } = render();
      act(() => {
        result.current.handleDeleteSelection([], "a");
      });
      expect(draft.overlays.find((o) => o.id === "a")).toBeUndefined();
      expect(draft.overlays).toHaveLength(1);
    });

    it("removes all multi-selected overlays", () => {
      const { result } = render();
      act(() => {
        result.current.handleDeleteSelection(["a", "b"], "a");
      });
      expect(draft.overlays).toHaveLength(0);
    });

    it("does nothing when no overlay selected", () => {
      const { result } = render();
      act(() => {
        result.current.handleDeleteSelection([], "");
      });
      expect(updateDraft).not.toHaveBeenCalled();
    });
  });

  // ── updateSelectedOverlay ───────────────────────────────────────────────

  describe("updateSelectedOverlay", () => {
    it("applies transform to the selected overlay only", () => {
      const { result } = render();
      act(() => {
        result.current.updateSelectedOverlay("a", (o) => ({
          ...o,
          content: { ...o.content, text: "updated" },
        }));
      });
      expect(draft.overlays.find((o) => o.id === "a")!.content.text).toBe("updated");
      expect(draft.overlays.find((o) => o.id === "b")!.content.text).toBe("b");
    });

    it("does nothing when overlay id not found", () => {
      const { result } = render();
      act(() => {
        result.current.updateSelectedOverlay("nonexistent", (o) => o);
      });
      expect(updateDraft).not.toHaveBeenCalled();
    });
  });
});
