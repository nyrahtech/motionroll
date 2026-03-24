/**
 * useEditorDraft — owns the editor draft document and undo/redo history.
 *
 * Overlay mutation operations live in useOverlayMutations, which this hook
 * composes and re-exports so callers see a single unified interface.
 */
import { useCallback, useRef, useState } from "react";
import type { OverlayAnimationType } from "@motionroll/shared";
import type { HydratedOverlayDefinition, EditorDraft } from "../editor-draft-types";
import type { TimelineTrackModel } from "../timeline-model";
import { useOverlayMutations } from "./useOverlayMutations";

const MAX_HISTORY = 40;

type HistoryState = {
  past: EditorDraft[];
  future: EditorDraft[];
};

export type UseEditorDraftReturn = {
  draft: EditorDraft;
  canUndo: boolean;
  canRedo: boolean;
  draftRef: React.MutableRefObject<EditorDraft>;
  draftVersionRef: React.MutableRefObject<number>;
  updateDraft: (transform: (current: EditorDraft) => EditorDraft, recordHistory?: boolean) => void;
  replaceDraftState: (
    nextDraft: EditorDraft,
    options?: { clearHistory?: boolean; hasUnsyncedChanges?: boolean },
  ) => void;
  setHasUnsyncedChangesFromDraft: (value: boolean) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  // All overlay/clip mutations (from useOverlayMutations)
  addOverlay: (type: string, playhead: number, frameCount: number) => string | null;
  handleGroupSelection: (multiSelectedOverlayIds: string[], playhead: number, frameCount: number) => void;
  handleUngroupOverlay: (overlayId: string, onAfter?: (childId: string) => void) => void;
  handleDuplicateClip: (clipId: string, tracks: TimelineTrackModel[]) => string | null;
  handleDeleteClip: (clipId: string, tracks: TimelineTrackModel[]) => void;
  handleCommitClipMove: (move: { clipId: string; start: number; end: number; targetLayer?: number }, tracks: TimelineTrackModel[]) => void;
  handleMoveClipToLayer: (clipId: string, targetLayer: number, tracks: TimelineTrackModel[]) => void;
  handleMoveClipToNewLayer: (clipId: string, tracks: TimelineTrackModel[]) => void;
  handleSetClipEnterAnimationType: (clipId: string, type: OverlayAnimationType, tracks: TimelineTrackModel[]) => void;
  handleSetClipExitAnimationType: (clipId: string, type: OverlayAnimationType, tracks: TimelineTrackModel[]) => void;
  handleReorderOverlays: (fromIndex: number, toIndex: number) => void;
  handleAddLayer: () => void;
  handleDeleteLayer: (layerRowIndex: number) => void;
  handleClipTimingChange: (clipId: string, timing: { start: number; end: number }, frameCount: number, tracks: TimelineTrackModel[]) => void;
  handleMoveSelection: (delta: { x: number; y: number }, multiSelectedOverlayIds: string[]) => void;
  handleDuplicateSelection: (multiSelectedOverlayIds: string[], selectedOverlayId: string) => { duplicateIds: string[] };
  handleDeleteSelection: (multiSelectedOverlayIds: string[], selectedOverlayId: string) => void;
  handleOverlayStyleQuickChange: (overlayId: string, changes: Record<string, unknown>) => void;
  updateSelectedOverlay: (selectedOverlayId: string, transform: (overlay: HydratedOverlayDefinition) => HydratedOverlayDefinition) => void;
};

export function useEditorDraft(
  initialDraft: EditorDraft,
  onUnsyncedChange: (hasChanges: boolean) => void,
  onRemoteSyncState: (state: "idle" | "syncing" | "synced" | "error") => void,
): UseEditorDraftReturn {
  const [draft, setDraft] = useState<EditorDraft>(initialDraft);
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const draftRef = useRef<EditorDraft>(initialDraft);
  const draftVersionRef = useRef(0);

  // ── Core: apply + update + replace ───────────────────────────────────────

  const applyDraft = useCallback(
    (nextDraft: EditorDraft, recordHistory = true) => {
      const current = draftRef.current;
      if (current === nextDraft) return;
      if (recordHistory) {
        setHistory((h) => ({
          past: [...h.past.slice(-(MAX_HISTORY - 1)), structuredClone(current)],
          future: [],
        }));
      }
      draftRef.current = nextDraft;
      draftVersionRef.current += 1;
      setDraft(nextDraft);
      onUnsyncedChange(true);
      onRemoteSyncState("idle");
    },
    [onUnsyncedChange, onRemoteSyncState],
  );

  const updateDraft = useCallback(
    (transform: (current: EditorDraft) => EditorDraft, recordHistory = true) => {
      applyDraft(transform(structuredClone(draftRef.current)), recordHistory);
    },
    [applyDraft],
  );

  const replaceDraftState = useCallback(
    (nextDraft: EditorDraft, options: { clearHistory?: boolean; hasUnsyncedChanges?: boolean } = {}) => {
      if (draftRef.current !== nextDraft) {
        draftVersionRef.current += 1;
      }
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      if (options.clearHistory) setHistory({ past: [], future: [] });
      if (typeof options.hasUnsyncedChanges === "boolean") onUnsyncedChange(options.hasUnsyncedChanges);
    },
    [onUnsyncedChange],
  );

  // ── Undo / redo ───────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      const previous = h.past.at(-1);
      if (!previous) return h;
      const current = structuredClone(draftRef.current);
      draftRef.current = structuredClone(previous);
      draftVersionRef.current += 1;
      setDraft(structuredClone(previous));
      onUnsyncedChange(true);
      onRemoteSyncState("idle");
      return { past: h.past.slice(0, -1), future: [current, ...h.future].slice(0, MAX_HISTORY) };
    });
  }, [onUnsyncedChange, onRemoteSyncState]);

  const handleRedo = useCallback(() => {
    setHistory((h) => {
      const [next, ...future] = h.future;
      if (!next) return h;
      const current = structuredClone(draftRef.current);
      draftRef.current = structuredClone(next);
      draftVersionRef.current += 1;
      setDraft(structuredClone(next));
      onUnsyncedChange(true);
      onRemoteSyncState("idle");
      return { past: [...h.past, current].slice(-MAX_HISTORY), future };
    });
  }, [onUnsyncedChange, onRemoteSyncState]);

  // ── Compose overlay mutations ─────────────────────────────────────────────

  const mutations = useOverlayMutations({
    updateDraft,
    draftRef,
    onUnsyncedChange,
    onRemoteSyncState,
    setDraftDirect: setDraft,
  });

  return {
    draft,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    draftRef,
    draftVersionRef,
    updateDraft,
    replaceDraftState,
    setHasUnsyncedChangesFromDraft: onUnsyncedChange,
    handleUndo,
    handleRedo,
    ...mutations,
  };
}
