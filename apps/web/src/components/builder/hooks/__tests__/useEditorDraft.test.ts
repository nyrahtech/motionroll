/**
 * Unit tests for useEditorDraft — undo/redo/history behavior.
 * Run with: vitest run
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorDraft } from "../useEditorDraft";
import type { EditorDraft } from "../../editor-draft-types";

// Minimal EditorDraft fixture
function makeDraft(title = "Draft"): EditorDraft {
  return {
    title,
    presetId: "product-reveal" as const,
    sectionTitle: "Scene 01",
    sectionHeightVh: 240,
    scrubStrength: 1,
    frameRangeStart: 0,
    frameRangeEnd: 180,
    layerCount: 1,
    overlays: [],
  };
}

describe("useEditorDraft", () => {
  let onUnsyncedChange: ReturnType<typeof vi.fn>;
  let onRemoteSyncState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUnsyncedChange = vi.fn();
    onRemoteSyncState = vi.fn();
  });

  function renderEditorDraft(initial = makeDraft()) {
    return renderHook(() =>
      useEditorDraft(initial, onUnsyncedChange, onRemoteSyncState),
    );
  }

  // ── Initial state ──────────────────────────────────────────────────────────

  it("initializes with the provided draft", () => {
    const { result } = renderEditorDraft(makeDraft("My Project"));
    expect(result.current.draft.title).toBe("My Project");
  });

  it("initializes with canUndo=false and canRedo=false", () => {
    const { result } = renderEditorDraft();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("initializes the draft version at zero", () => {
    const { result } = renderEditorDraft();
    expect(result.current.draftVersionRef.current).toBe(0);
  });

  // ── updateDraft ────────────────────────────────────────────────────────────

  it("updateDraft changes the draft", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "Updated" }));
    });
    expect(result.current.draft.title).toBe("Updated");
  });

  it("updateDraft increments the draft version", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "Updated" }));
    });
    expect(result.current.draftVersionRef.current).toBe(1);
  });

  it("updateDraft calls onUnsyncedChange(true)", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "X" }));
    });
    expect(onUnsyncedChange).toHaveBeenCalledWith(true);
  });

  it("updateDraft records history by default", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "A" }));
    });
    expect(result.current.canUndo).toBe(true);
  });

  it("updateDraft does NOT record history when recordHistory=false", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "A" }), false);
    });
    expect(result.current.canUndo).toBe(false);
  });

  // ── Undo ──────────────────────────────────────────────────────────────────

  it("handleUndo restores the previous draft", () => {
    const { result } = renderEditorDraft(makeDraft("Original"));
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "Changed" }));
    });
    expect(result.current.draft.title).toBe("Changed");

    act(() => {
      result.current.handleUndo();
    });
    expect(result.current.draft.title).toBe("Original");
  });

  it("handleUndo is a no-op when history is empty", () => {
    const { result } = renderEditorDraft(makeDraft("Original"));
    act(() => {
      result.current.handleUndo();
    });
    expect(result.current.draft.title).toBe("Original");
  });

  it("handleUndo enables canRedo after undoing", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "A" }));
    });
    act(() => {
      result.current.handleUndo();
    });
    expect(result.current.canRedo).toBe(true);
  });

  it("undo and redo both advance the draft version", () => {
    const { result } = renderEditorDraft(makeDraft("Original"));
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "Changed" }));
    });
    expect(result.current.draftVersionRef.current).toBe(1);

    act(() => {
      result.current.handleUndo();
    });
    expect(result.current.draftVersionRef.current).toBe(2);

    act(() => {
      result.current.handleRedo();
    });
    expect(result.current.draftVersionRef.current).toBe(3);
  });

  // ── Redo ──────────────────────────────────────────────────────────────────

  it("handleRedo re-applies the undone draft", () => {
    const { result } = renderEditorDraft(makeDraft("Original"));
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "Changed" }));
    });
    act(() => {
      result.current.handleUndo();
    });
    act(() => {
      result.current.handleRedo();
    });
    expect(result.current.draft.title).toBe("Changed");
  });

  it("new updateDraft clears the redo stack", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "A" }));
      result.current.updateDraft((d) => ({ ...d, title: "B" }));
    });
    act(() => {
      result.current.handleUndo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "C" }));
    });
    expect(result.current.canRedo).toBe(false);
    expect(result.current.draft.title).toBe("C");
  });

  // ── replaceDraftState ──────────────────────────────────────────────────────

  it("replaceDraftState with clearHistory=true resets undo/redo", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.updateDraft((d) => ({ ...d, title: "A" }));
      result.current.updateDraft((d) => ({ ...d, title: "B" }));
    });
    act(() => {
      result.current.replaceDraftState(makeDraft("Remote"), { clearHistory: true });
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.draft.title).toBe("Remote");
  });

  it("replaceDraftState with hasUnsyncedChanges=false fires onUnsyncedChange(false)", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.replaceDraftState(makeDraft("X"), { hasUnsyncedChanges: false });
    });
    expect(onUnsyncedChange).toHaveBeenCalledWith(false);
  });

  it("replaceDraftState increments the draft version when swapping in a remote draft", () => {
    const { result } = renderEditorDraft();
    act(() => {
      result.current.replaceDraftState(makeDraft("Remote"), { hasUnsyncedChanges: false });
    });
    expect(result.current.draftVersionRef.current).toBe(1);
  });

  // ── History limit ──────────────────────────────────────────────────────────

  it("history is capped at 40 entries", () => {
    const { result } = renderEditorDraft(makeDraft("0"));
    act(() => {
      for (let i = 1; i <= 50; i++) {
        const idx = i;
        result.current.updateDraft((d) => ({ ...d, title: String(idx) }));
      }
    });

    let undoCount = 0;

    while (result.current.canUndo) {
      act(() => {
        result.current.handleUndo();
      });
      undoCount++;
    }

    expect(undoCount).toBe(40);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.draft.title).toBe("10");
  });
});
