/**
 * useOverlayMutations — all overlay/clip CRUD operations.
 *
 * Takes `updateDraft` and `draftRef` from `useEditorDraft` and returns
 * stable callbacks for every overlay mutation the editor can perform.
 * This keeps `useEditorDraft` focused on history + state primitives.
 */
import { useCallback } from "react";
import { useSelectionMutations } from "./useSelectionMutations";
import {
  clampProgress,
  normalizeTimingRange,
  type FontFamily,
  type OverlayDefinition,
  type TransitionPreset,
} from "@motionroll/shared";
import type { HydratedOverlayDefinition, EditorDraft } from "../editor-draft-types";
import {
  normalizeOverlayLayers,
  getRequiredLayerCount,
  buildOverlayId,
  createDefaultOverlay,
  getOverlayById,
  getOverlayAbsoluteBounds,
  isGroupOverlay,
  getDirectGroupChildren,
  getGroupSelectionEligibility,
  duplicateRootOverlays,
  deleteRootOverlays,
  reorderOverlayLayers,
  DESIGN_STAGE_WIDTH,
  DESIGN_STAGE_HEIGHT,
} from "../editor-overlay-utils";
import {
  getFrameRangeFromClip,
  type TimelineTrackModel,
} from "../timeline-model";

type UpdateDraft = (transform: (current: EditorDraft) => EditorDraft, recordHistory?: boolean) => void;

function findClip(tracks: TimelineTrackModel[], clipId: string) {
  return tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
}

export function useOverlayMutations({
  updateDraft,
  draftRef,
  onUnsyncedChange,
  onRemoteSyncState,
  setDraftDirect,
}: {
  updateDraft: UpdateDraft;
  draftRef: React.MutableRefObject<EditorDraft>;
  onUnsyncedChange: (v: boolean) => void;
  onRemoteSyncState: (s: "idle" | "syncing" | "synced" | "error") => void;
  /** Direct setState for quick-change (bypasses history) */
  setDraftDirect: React.Dispatch<React.SetStateAction<EditorDraft>>;
}) {
  // ── Overlay add ───────────────────────────────────────────────────────────

  const addOverlay = useCallback(
    (type: string, playhead: number): string | null => {
      if (type === "video") return null;
      const normalizedType = type === "section" ? "moment" : type;
      const contentType =
        normalizedType === "image" || normalizedType === "logo" || normalizedType === "icon"
          ? (normalizedType as "image" | "logo" | "icon")
          : "text";
      const overlayId = buildOverlayId(normalizedType);
      const overlay = createDefaultOverlay(overlayId, contentType, playhead, undefined);
      if (normalizedType === "moment") {
        overlay.content.text = "Moment\n\nNew section beat";
        overlay.content.transition = { preset: "wipe", easing: "ease-in-out", duration: 0.42 };
      }
      updateDraft((current) => ({
        ...current,
        layerCount: getRequiredLayerCount(current.overlays, current.layerCount),
        overlays: normalizeOverlayLayers([
          {
            ...overlay,
            content: {
              ...overlay.content,
              layer: Math.max(getRequiredLayerCount(current.overlays, current.layerCount) - 1, 0),
            },
          },
          ...current.overlays,
        ]),
      }));
      return overlayId;
    },
    [updateDraft],
  );

  // ── Group / ungroup ───────────────────────────────────────────────────────

  const handleGroupSelection = useCallback(
    (multiSelectedOverlayIds: string[], playhead: number) => {
      updateDraft((current) => {
        if (!getGroupSelectionEligibility(current.overlays, multiSelectedOverlayIds)) return current;
        const selected = multiSelectedOverlayIds
          .map((id) => getOverlayById(current.overlays, id))
          .filter((o): o is HydratedOverlayDefinition => Boolean(o));
        if (selected.length < 2) return current;

        const bounds = selected.map(getOverlayAbsoluteBounds).reduce<{
          left: number;
          top: number;
          right: number;
          bottom: number;
        }>(
          (acc, next) => ({
            left: Math.min(acc.left, next.left),
            top: Math.min(acc.top, next.top),
            right: Math.max(acc.right, next.right),
            bottom: Math.max(acc.bottom, next.bottom),
          }),
          { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
        );

        const groupId = buildOverlayId("group");
        const group = createDefaultOverlay(groupId, "group", playhead);
        group.timing = normalizeTimingRange(
          { start: Math.min(...selected.map((o) => o.timing.start)), end: Math.max(...selected.map((o) => o.timing.end)) },
          0.08,
        );
        group.content.layer = Math.max(...selected.map((o) => o.content.layer ?? 0));
        group.content.layout = {
          x: clampProgress(bounds.left),
          y: clampProgress(bounds.top),
          width: Math.max(140, Math.round((bounds.right - bounds.left) * DESIGN_STAGE_WIDTH)),
          height: Math.max(80, Math.round((bounds.bottom - bounds.top) * DESIGN_STAGE_HEIGHT)),
        };
        group.content.style.maxWidth = group.content.layout.width;
        group.content.background.paddingX = 0;
        group.content.background.paddingY = 0;

        const nextOverlays = normalizeOverlayLayers([
          group,
          ...current.overlays.map((o) =>
            multiSelectedOverlayIds.includes(o.id)
              ? { ...o, content: { ...o.content, parentGroupId: groupId } }
              : o,
          ),
        ]);
        return { ...current, layerCount: getRequiredLayerCount(nextOverlays, current.layerCount), overlays: nextOverlays };
      });
    },
    [updateDraft],
  );

  const handleUngroupOverlay = useCallback(
    (overlayId: string, onAfter?: (childId: string) => void) => {
      updateDraft((current) => {
        const overlay = getOverlayById(current.overlays, overlayId);
        if (!overlay || !isGroupOverlay(overlay)) return current;
        const nextOverlays = normalizeOverlayLayers(
          current.overlays
            .filter((item) => item.id !== overlayId)
            .map((item) =>
              item.content.parentGroupId === overlayId
                ? { ...item, content: { ...item.content, parentGroupId: undefined } }
                : item,
            ),
        );
        queueMicrotask(() => {
          const childId = getDirectGroupChildren(current.overlays, overlayId)[0]?.id ?? "";
          onAfter?.(childId);
        });
        return { ...current, layerCount: getRequiredLayerCount(nextOverlays, current.layerCount), overlays: nextOverlays };
      });
    },
    [updateDraft],
  );

  // ── Clip duplicate / delete ───────────────────────────────────────────────

  const handleDuplicateClip = useCallback(
    (clipId: string, tracks: TimelineTrackModel[]): string | null => {
      const clip = findClip(tracks, clipId);
      const overlayId = clip?.metadata?.overlayId;
      if (!overlayId) return null;
      let nextDuplicateId = "";
      updateDraft((current) => {
        const { overlays, duplicateIds } = duplicateRootOverlays(current.overlays, [overlayId]);
        const duplicateId = duplicateIds[0];
        if (!duplicateId) return current;
        nextDuplicateId = duplicateId;
        return { ...current, overlays };
      });
      return nextDuplicateId || null;
    },
    [updateDraft],
  );

  const handleDeleteClip = useCallback(
    (clipId: string, tracks: TimelineTrackModel[]) => {
      const clip = findClip(tracks, clipId);
      const overlayId = clip?.metadata?.overlayId;
      if (!overlayId) return;
      updateDraft((current) => {
        const nextOverlays = deleteRootOverlays(current.overlays, [overlayId]);
        return { ...current, layerCount: getRequiredLayerCount(nextOverlays, current.layerCount), overlays: normalizeOverlayLayers(nextOverlays) };
      });
    },
    [updateDraft],
  );

  // ── Clip timing / move ────────────────────────────────────────────────────

  const handleClipTimingChange = useCallback(
    (clipId: string, timing: { start: number; end: number }, frameCount: number, tracks: TimelineTrackModel[]) => {
      const clip = findClip(tracks, clipId);
      if (!clip) return;
      updateDraft((current) => {
        if (clip.trackType === "section") {
          const nextFrameRange = getFrameRangeFromClip(timing, frameCount);
          return { ...current, frameRangeStart: nextFrameRange.start, frameRangeEnd: nextFrameRange.end };
        }
        const overlayId = clip.metadata?.overlayId;
        if (!overlayId) return current;
        return { ...current, overlays: current.overlays.map((o) => o.id === overlayId ? { ...o, timing } : o) };
      });
    },
    [updateDraft],
  );

  const handleCommitClipMove = useCallback(
    (move: { clipId: string; start: number; end: number; targetLayer?: number }, tracks: TimelineTrackModel[]) => {
      const clip = findClip(tracks, move.clipId);
      const overlayId = clip?.metadata?.overlayId;
      if (!overlayId) return;
      updateDraft((current) => {
        const overlay = getOverlayById(current.overlays, overlayId);
        if (!overlay) return current;
        const nextOverlays = current.overlays.map((item) => {
          if (item.id === overlayId) {
            return { ...item, timing: { start: move.start, end: move.end }, content: { ...item.content, layer: move.targetLayer ?? item.content.layer ?? 0 } };
          }
          if (isGroupOverlay(overlay) && item.content.parentGroupId === overlayId) {
            return { ...item, content: { ...item.content, layer: move.targetLayer ?? overlay.content.layer ?? item.content.layer ?? 0 } };
          }
          return item;
        });
        return { ...current, layerCount: getRequiredLayerCount(nextOverlays, current.layerCount), overlays: normalizeOverlayLayers(nextOverlays) };
      });
    },
    [updateDraft],
  );

  const handleMoveClipToLayer = useCallback(
    (clipId: string, targetLayer: number, tracks: TimelineTrackModel[]) => {
      const clip = findClip(tracks, clipId);
      if (!clip) return;
      handleCommitClipMove({ clipId, start: clip.start, end: clip.end, targetLayer }, tracks);
    },
    [handleCommitClipMove],
  );

  const handleMoveClipToNewLayer = useCallback(
    (clipId: string, tracks: TimelineTrackModel[]) => {
      const clip = findClip(tracks, clipId);
      const overlayId = clip?.metadata?.overlayId;
      if (!overlayId) return;
      updateDraft((current) => {
        const targetLayer = current.layerCount;
        return {
          ...current,
          layerCount: targetLayer + 1,
          overlays: normalizeOverlayLayers(
            current.overlays.map((o) =>
              o.id === overlayId || o.content.parentGroupId === overlayId
                ? { ...o, content: { ...o.content, layer: targetLayer } }
                : o,
            ),
          ),
        };
      });
    },
    [updateDraft],
  );

  // ── Layer management ──────────────────────────────────────────────────────

  const handleReorderOverlays = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateDraft((current) => ({
        ...current,
        overlays: reorderOverlayLayers(current.overlays, current.layerCount, fromIndex, toIndex),
      }));
    },
    [updateDraft],
  );

  const handleAddLayer = useCallback(() => {
    updateDraft((current) => ({ ...current, layerCount: current.layerCount + 1 }));
  }, [updateDraft]);

  const handleDeleteLayer = useCallback(
    (layerRowIndex: number) => {
      updateDraft((current) => {
        if (current.layerCount <= 1 || layerRowIndex < 0 || layerRowIndex >= current.layerCount) return current;
        const layerValue = current.layerCount - layerRowIndex - 1;
        const deletedRootIds = new Set(
          current.overlays.filter((o) => !o.content.parentGroupId && (o.content.layer ?? 0) === layerValue).map((o) => o.id),
        );
        const nextOverlays = current.overlays.flatMap((overlay) => {
          if (deletedRootIds.has(overlay.id) || (overlay.content.parentGroupId && deletedRootIds.has(overlay.content.parentGroupId))) return [];
          const overlayLayer = overlay.content.layer ?? 0;
          if (!overlay.content.parentGroupId && overlayLayer > layerValue) {
            return [{ ...overlay, content: { ...overlay.content, layer: overlayLayer - 1 } }];
          }
          return [overlay];
        });
        return { ...current, layerCount: getRequiredLayerCount(nextOverlays, current.layerCount - 1), overlays: normalizeOverlayLayers(nextOverlays) };
      });
    },
    [updateDraft],
  );


  // ── Style / quick-change ──────────────────────────────────────────────────

  const handleOverlayStyleQuickChange = useCallback(
    (overlayId: string, changes: Record<string, unknown>) => {
      setDraftDirect((current) => {
        let didChange = false;
        const overlays = current.overlays.map((overlay) => {
          if (overlay.id !== overlayId) return overlay;
          didChange = true;
          return {
            ...overlay,
            content: {
              ...overlay.content,
              style: {
                ...overlay.content.style,
                ...(changes.fontFamily !== undefined ? { fontFamily: String(changes.fontFamily) as FontFamily } : {}),
                ...(changes.fontWeight !== undefined ? { fontWeight: Number(changes.fontWeight) } : {}),
                ...(changes.fontSize !== undefined ? { fontSize: Number(changes.fontSize) } : {}),
                ...(changes.color !== undefined ? { color: String(changes.color) } : {}),
                ...(changes.italic !== undefined ? { italic: Boolean(changes.italic) } : {}),
                ...(changes.underline !== undefined ? { underline: Boolean(changes.underline) } : {}),
                ...(changes.textAlign !== undefined ? { textAlign: changes.textAlign as "start" | "center" | "end" } : {}),
              },
              background: {
                ...overlay.content.background,
                ...(changes.backgroundColor !== undefined ? { color: String(changes.backgroundColor) } : {}),
                ...(changes.backgroundBorderColor !== undefined ? { borderColor: String(changes.backgroundBorderColor) } : {}),
              },
            },
          };
        });
        if (!didChange) return current;
        const nextDraft = { ...current, overlays };
        draftRef.current = nextDraft;
        onUnsyncedChange(true);
        onRemoteSyncState("idle");
        return nextDraft;
      });
    },
    [setDraftDirect, draftRef, onUnsyncedChange, onRemoteSyncState],
  );

  const handleSetClipTransitionPreset = useCallback(
    (clipId: string, preset: string | undefined, tracks: TimelineTrackModel[]) => {
      const clip = findClip(tracks, clipId);
      const overlayId = clip?.metadata?.overlayId;
      if (!overlayId) return;
      updateDraft((current) => ({
        ...current,
        overlays: current.overlays.map((overlay) =>
          overlay.id === overlayId
            ? {
                ...overlay,
                content: {
                  ...overlay.content,
                  transition: {
                    ...(overlay.content.transition ?? { preset: "fade", easing: "ease-in-out", duration: 0.4 }),
                    preset: (preset ?? "fade") as TransitionPreset,
                  },
                },
              }
            : overlay,
        ),
      }));
    },
    [updateDraft],
  );


  const selectionMutations = useSelectionMutations({ updateDraft, draftRef });

  return {
    addOverlay,
    ...selectionMutations,
    handleGroupSelection,
    handleUngroupOverlay,
    handleDuplicateClip,
    handleDeleteClip,
    handleClipTimingChange,
    handleCommitClipMove,
    handleMoveClipToLayer,
    handleMoveClipToNewLayer,
    handleReorderOverlays,
    handleAddLayer,
    handleDeleteLayer,
    handleOverlayStyleQuickChange,
    handleSetClipTransitionPreset,
  };
}
