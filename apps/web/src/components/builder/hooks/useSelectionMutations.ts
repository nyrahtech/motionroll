"use client";

import { useCallback } from "react";
import type { EditorDraft, HydratedOverlayDefinition } from "../editor-draft-types";
import {
  normalizeOverlayLayers,
  getRequiredLayerCount,
  hydrateOverlay,
  getRootOverlayId,
  duplicateRootOverlays,
  deleteRootOverlays,
  shiftOverlayAbsoluteLayout,
} from "../editor-overlay-utils";

type UpdateDraft = (transform: (current: EditorDraft) => EditorDraft, recordHistory?: boolean) => void;

export function useSelectionMutations({
  updateDraft,
  draftRef,
}: {
  updateDraft: UpdateDraft;
  draftRef: React.MutableRefObject<EditorDraft>;
}) {
  // ── Multi-selection operations ────────────────────────────────────────────

  const handleMoveSelection = useCallback(
    (delta: { x: number; y: number }, multiSelectedOverlayIds: string[]) => {
      if (multiSelectedOverlayIds.length < 2) return;
      updateDraft((current) => ({
        ...current,
        overlays: current.overlays.map((overlay) => {
          const isRoot = multiSelectedOverlayIds.includes(overlay.id);
          const isGroupChild = overlay.content.parentGroupId !== undefined && multiSelectedOverlayIds.includes(overlay.content.parentGroupId);
          if (!isRoot && !isGroupChild) return overlay;
          return shiftOverlayAbsoluteLayout(hydrateOverlay(overlay), delta.x, delta.y);
        }),
      }));
    },
    [updateDraft],
  );

  const handleDuplicateSelection = useCallback(
    (multiSelectedOverlayIds: string[], selectedOverlayId: string): { duplicateIds: string[] } => {
      if (multiSelectedOverlayIds.length < 2) {
        if (!selectedOverlayId) return { duplicateIds: [] };
        const rootId = getRootOverlayId(draftRef.current.overlays, selectedOverlayId);
        let duplicateId = "";
        updateDraft((current) => {
          const { overlays, duplicateIds } = duplicateRootOverlays(current.overlays, [rootId]);
          duplicateId = duplicateIds[0] ?? "";
          return { ...current, overlays };
        });
        return { duplicateIds: duplicateId ? [duplicateId] : [] };
      }
      let duplicateIds: string[] = [];
      updateDraft((current) => {
        const result = duplicateRootOverlays(current.overlays, multiSelectedOverlayIds);
        duplicateIds = result.duplicateIds;
        return { ...current, overlays: result.overlays };
      });
      return { duplicateIds };
    },
    [updateDraft, draftRef],
  );

  const handleDeleteSelection = useCallback(
    (multiSelectedOverlayIds: string[], selectedOverlayId: string) => {
      if (multiSelectedOverlayIds.length < 2) {
        if (!selectedOverlayId) return;
        const rootId = getRootOverlayId(draftRef.current.overlays, selectedOverlayId);
        updateDraft((current) => {
          const nextOverlays = deleteRootOverlays(current.overlays, [rootId]);
          return { ...current, layerCount: getRequiredLayerCount(nextOverlays, current.layerCount), overlays: normalizeOverlayLayers(nextOverlays) };
        });
        return;
      }
      updateDraft((current) => {
        const overlays = deleteRootOverlays(current.overlays, multiSelectedOverlayIds);
        return { ...current, layerCount: getRequiredLayerCount(overlays, current.layerCount), overlays };
      });
    },
    [updateDraft, draftRef],
  );

  // ── Selected overlay helpers ──────────────────────────────────────────────

  const updateSelectedOverlay = useCallback(
    (selectedOverlayId: string, transform: (overlay: HydratedOverlayDefinition) => HydratedOverlayDefinition) => {
      const selectedOverlay = draftRef.current.overlays.find((o) => o.id === selectedOverlayId);
      if (!selectedOverlay) return;
      updateDraft((current) => ({
        ...current,
        overlays: current.overlays.map((overlay) =>
          overlay.id === selectedOverlay.id ? transform(overlay) : overlay,
        ),
      }));
    },
    [updateDraft, draftRef],
  );

  return {
    handleMoveSelection,
    handleDuplicateSelection,
    handleDeleteSelection,
    updateSelectedOverlay,
  };
}
