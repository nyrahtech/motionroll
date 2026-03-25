/**
 * Tests for useOverlayCallbacks — overlay field, style, animation
 * and layout change handlers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOverlayCallbacks } from "../useOverlayCallbacks";
import type { EditorDraft, HydratedOverlayDefinition } from "../../editor-draft-types";

function makeOverlay(id: string): HydratedOverlayDefinition {
  return {
    id,
    timing: { start: 0.1, end: 0.8 },
    timingSource: "manual",
    content: {
      type: "text",
      text: "hello",
      align: "start",
      theme: "dark",
      treatment: "default",
      layer: 0,
      layout: { x: 0.2, y: 0.3, width: 420 },
      style: {
        fontFamily: "Inter", fontSize: 34, fontWeight: 600, color: "#fff", lineHeight: 1.08,
        letterSpacing: 0, textAlign: "start", opacity: 1, maxWidth: 420,
        italic: false, underline: false, textTransform: "none", buttonLike: false,
      },
      background: {
        enabled: false, mode: "transparent", color: "#0d1016", opacity: 0.82,
        radius: 14, paddingX: 18, paddingY: 14, borderColor: "#d6f6ff", borderOpacity: 0,
      },
      enterAnimation: { type: "fade", easing: "ease-out", duration: 0.45, delay: 0 },
      exitAnimation: { type: "none", easing: "ease-in-out", duration: 0.35 },
    },
  };
}

function makeDraft(overlayId: string): EditorDraft {
  return {
    title: "Test", presetId: "product-reveal" as const,
    sectionTitle: "Scene",
    sceneEnterTransition: { preset: "none", duration: 0.4 },
    sceneExitTransition: { preset: "none", duration: 0.4 },
    sectionHeightVh: 240,
    scrubStrength: 1,
    frameRangeStart: 0, frameRangeEnd: 180, layerCount: 1,
    overlays: [makeOverlay(overlayId)],
  };
}

describe("useOverlayCallbacks", () => {
  const overlayId = "ov-1";
  let draft: EditorDraft;
  let updateDraft: ReturnType<typeof vi.fn>;
  let updateSelectedOverlay: ReturnType<typeof vi.fn>;
  let handleOverlayStyleQuickChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    draft = makeDraft(overlayId);
    updateDraft = vi.fn((transform) => { draft = transform(draft); });
    updateSelectedOverlay = vi.fn((id, transform) => {
      const overlay = draft.overlays.find((o) => o.id === id);
      if (overlay) {
        const updated = transform(overlay);
        draft = { ...draft, overlays: draft.overlays.map((o) => o.id === id ? updated : o) };
      }
    });
    handleOverlayStyleQuickChange = vi.fn();
  });

  function render() {
    return renderHook(() =>
      useOverlayCallbacks({
        selectedOverlayId: overlayId,
        updateDraft,
        updateSelectedOverlay,
        handleOverlayStyleQuickChange,
      }),
    );
  }

  // ── onOverlayFieldChange ────────────────────────────────────────────────

  describe("onOverlayFieldChange", () => {
    it("updates text field", () => {
      const { result } = render();
      act(() => result.current.onOverlayFieldChange("text", "new text"));
      expect(draft.overlays[0]!.content.text).toBe("new text");
    });

    it("updates timing start without violating minimum range", () => {
      const { result } = render();
      act(() => result.current.onOverlayFieldChange("start", 0.05));
      expect(draft.overlays[0]!.timing.start).toBeCloseTo(0.05);
      expect(draft.overlays[0]!.timingSource).toBe("manual");
    });

    it("does nothing when no overlay is selected", () => {
      const { result: r } = renderHook(() =>
        useOverlayCallbacks({
          selectedOverlayId: "",
          updateDraft,
          updateSelectedOverlay,
          handleOverlayStyleQuickChange,
        }),
      );
      act(() => r.current.onOverlayFieldChange("text", "ignored"));
      expect(updateSelectedOverlay).not.toHaveBeenCalled();
    });
  });

  // ── onOverlayStyleChange ────────────────────────────────────────────────

  describe("onOverlayStyleChange", () => {
    it("updates a style property", () => {
      const { result } = render();
      act(() => result.current.onOverlayStyleChange("fontSize", 48));
      expect(draft.overlays[0]!.content.style.fontSize).toBe(48);
    });

    it("updates background color without touching other bg props", () => {
      const { result } = render();
      act(() => result.current.onOverlayStyleChange("backgroundColor", "#ff0000"));
      const bg = draft.overlays[0]!.content.background;
      expect(bg.color).toBe("#ff0000");
      expect(bg.radius).toBe(14); // unchanged
    });

    it("enabling background sets enabled=true", () => {
      const { result } = render();
      act(() => result.current.onOverlayStyleChange("backgroundEnabled", true));
      expect(draft.overlays[0]!.content.background.enabled).toBe(true);
    });

    it("layout fields (x,y,width,height) go into layout not style", () => {
      const { result } = render();
      act(() => result.current.onOverlayStyleChange("x", 0.5));
      expect(draft.overlays[0]!.content.layout?.x).toBeCloseTo(0.5);
      // style should be unchanged
      expect(draft.overlays[0]!.content.style.fontSize).toBe(34);
    });
  });

  // ── onOverlayStyleLiveChange ────────────────────────────────────────────

  describe("onOverlayStyleLiveChange", () => {
    it("calls handleOverlayStyleQuickChange with field/value map", () => {
      const { result } = render();
      act(() => result.current.onOverlayStyleLiveChange("color", "#abc123"));
      expect(handleOverlayStyleQuickChange).toHaveBeenCalledWith(overlayId, { color: "#abc123" });
    });
  });

  // ── onOverlayEnterAnimationChange ───────────────────────────────────────

  describe("onOverlayEnterAnimationChange", () => {
    it("updates enter animation type", () => {
      const { result } = render();
      act(() => result.current.onOverlayEnterAnimationChange("type", "slide-up-fade"));
      expect(draft.overlays[0]!.content.enterAnimation?.type).toBe("slide-up-fade");
    });

    it("updates enter animation duration", () => {
      const { result } = render();
      act(() => result.current.onOverlayEnterAnimationChange("duration", 0.8));
      expect(draft.overlays[0]!.content.enterAnimation?.duration).toBe(0.8);
    });
  });

  // ── onOverlayExitAnimationChange ────────────────────────────────────────

  describe("onOverlayExitAnimationChange", () => {
    it("updates exit animation type", () => {
      const { result } = render();
      act(() => result.current.onOverlayExitAnimationChange("type", "fade"));
      expect(draft.overlays[0]!.content.exitAnimation?.type).toBe("fade");
    });
  });

  // ── onInlineTextChange ──────────────────────────────────────────────────

  describe("onInlineTextChange", () => {
    it("updates text and textHtml together", () => {
      const { result } = render();
      act(() => result.current.onInlineTextChange(overlayId, "text", "plain", "<b>plain</b>"));
      expect(draft.overlays[0]!.content.text).toBe("plain");
    });
  });
});
