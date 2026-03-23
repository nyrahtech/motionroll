/**
 * useEditorSelection — owns timeline selection, overlay selection,
 * multi-selection, and sidebar context.
 */
import { useCallback, useEffect, useState } from "react";
import type { TimelineSelection, TimelineTrackModel } from "../timeline-model";
import type { SidebarContext } from "../editor-sidebar";
import type { HydratedOverlayDefinition } from "../editor-draft-types";
import {
  getRootOverlayId,
  getOverlayById,
  isGroupOverlay,
} from "../editor-overlay-utils";

export type UseEditorSelectionReturn = {
  selection: TimelineSelection;
  selectedOverlayId: string;
  multiSelectedOverlayIds: string[];
  activeSidebarContext: SidebarContext;
  setSelection: React.Dispatch<React.SetStateAction<TimelineSelection>>;
  setSelectedOverlayId: React.Dispatch<React.SetStateAction<string>>;
  setMultiSelectedOverlayIds: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveSidebarContext: React.Dispatch<React.SetStateAction<SidebarContext>>;
  selectOverlay: (overlayId: string, overlays: HydratedOverlayDefinition[], options?: { additive?: boolean }) => void;
  clearSelection: () => void;
  handleSelectionChange: (
    nextSelection: TimelineSelection,
    timelineTracks: TimelineTrackModel[],
    options?: { additive?: boolean },
  ) => void;
  syncWithOverlays: (overlays: HydratedOverlayDefinition[]) => void;
};

export function useEditorSelection(
  initialSelectedOverlayId: string,
  initialContext: SidebarContext,
  initialSelection: TimelineSelection,
): UseEditorSelectionReturn {
  const [selection, setSelection] = useState<TimelineSelection>(initialSelection);
  const [selectedOverlayId, setSelectedOverlayId] = useState(initialSelectedOverlayId);
  const [multiSelectedOverlayIds, setMultiSelectedOverlayIds] = useState<string[]>([]);
  const [activeSidebarContext, setActiveSidebarContext] = useState<SidebarContext>(initialContext);

  const clearSelection = useCallback(() => {
    setSelection({ clipId: "section-range", trackType: "section" });
    setSelectedOverlayId("");
    setMultiSelectedOverlayIds([]);
    setActiveSidebarContext((ctx) => (ctx === "edit" ? "insert" : ctx));
  }, []);

  const selectOverlay = useCallback(
    (
      overlayId: string,
      overlays: HydratedOverlayDefinition[],
      options?: { additive?: boolean },
    ) => {
      if (!overlayId) {
        clearSelection();
        return;
      }

      const rootOverlayId = getRootOverlayId(overlays, overlayId);
      const rootOverlay = getOverlayById(overlays, rootOverlayId);
      const nextSelectedOverlayId =
        rootOverlay && isGroupOverlay(rootOverlay) ? rootOverlayId : overlayId;

      setMultiSelectedOverlayIds((current) => {
        const nextSelectedIds = options?.additive
          ? current.includes(rootOverlayId)
            ? current.filter((id) => id !== rootOverlayId)
            : [...current, rootOverlayId]
          : [rootOverlayId];
        const activeRootOverlayId = nextSelectedIds.at(-1) ?? "";
        const nextSel = activeRootOverlayId
          ? { clipId: `layer-${activeRootOverlayId}`, trackType: "layer" as const }
          : { clipId: "section-range", trackType: "section" as const };

        setSelection((current) =>
          current?.clipId === nextSel.clipId && current.trackType === nextSel.trackType
            ? current
            : nextSel,
        );
        setSelectedOverlayId(options?.additive ? activeRootOverlayId : nextSelectedOverlayId);
        setActiveSidebarContext(activeRootOverlayId ? "edit" : "insert");
        return nextSelectedIds;
      });
    },
    [clearSelection],
  );

  const handleSelectionChange = useCallback(
    (
      nextSelection: TimelineSelection,
      timelineTracks: TimelineTrackModel[],
      options?: { additive?: boolean },
    ) => {
      const nextOverlayId =
        nextSelection?.trackType === "layer"
          ? timelineTracks
              .flatMap((t) => t.clips)
              .find((c) => c.id === nextSelection.clipId)?.metadata?.overlayId
          : undefined;

      if (nextOverlayId) {
        setMultiSelectedOverlayIds((current) => {
          const nextSelectedIds = options?.additive
            ? current.includes(nextOverlayId)
              ? current.filter((id) => id !== nextOverlayId)
              : [...current, nextOverlayId]
            : [nextOverlayId];
          const activeOverlayId = nextSelectedIds.at(-1) ?? "";
          setSelection(
            activeOverlayId
              ? { clipId: `layer-${activeOverlayId}`, trackType: "layer" }
              : { clipId: "section-range", trackType: "section" },
          );
          setSelectedOverlayId(activeOverlayId);
          setActiveSidebarContext(activeOverlayId ? "edit" : "insert");
          return nextSelectedIds;
        });
        return;
      }

      setSelection(nextSelection);
      setMultiSelectedOverlayIds([]);
      setSelectedOverlayId("");
      setActiveSidebarContext((ctx) => (ctx === "edit" ? "insert" : ctx));
    },
    [],
  );

  // Clean up selection when overlays are removed
  const syncWithOverlays = useCallback((overlays: HydratedOverlayDefinition[]) => {
    setSelectedOverlayId((current) => {
      if (!current) return current;
      if (overlays.some((o) => o.id === current)) return current;
      return "";
    });
    setMultiSelectedOverlayIds((current) =>
      current.filter((id) =>
        overlays.some((o) => o.id === id && !o.content.parentGroupId),
      ),
    );
  }, []);

  return {
    selection,
    selectedOverlayId,
    multiSelectedOverlayIds,
    activeSidebarContext,
    setSelection,
    setSelectedOverlayId,
    setMultiSelectedOverlayIds,
    setActiveSidebarContext,
    selectOverlay,
    clearSelection,
    handleSelectionChange,
    syncWithOverlays,
  };
}
