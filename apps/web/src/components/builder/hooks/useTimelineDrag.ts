/**
 * useTimelineDrag — all timeline drag logic:
 *   - Clip move/resize drag
 *   - Track layer reorder drag
 *   - Playhead scrub
 *   - Auto-scroll during drag
 *
 * Extracted from timeline-panel.tsx to keep that component focused on layout/render.
 */
"use client";

import { useCallback } from "react";
import { clampProgress } from "@motionroll/shared";
import {
  getClipInsertionIndex,
  getLayerDragGhostPosition,
  resolveLayerTrackIndexFromPointer,
  type LayerRowGeometry,
} from "../timeline-drag-preview";
import type { TimelineClipModel, TimelineSelection, TimelineTrackModel, TimelineTrackType } from "../timeline-model";
import type {
  ClipDragState,
  ClipDragMode,
  ClipGhostState,
  ClipMovePreviewState,
  ClipTimingPreviewState,
  DragGhostState,
  TrackReorderState,
} from "../timeline-types";

const DRAG_START_THRESHOLD = 5;
const EDGE_SCROLL_THRESHOLD = 88;
const EDGE_SCROLL_MAX_STEP = 18;

export type UseTimelineDragProps = {
  // DOM refs
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  trackAreaRef: React.MutableRefObject<HTMLDivElement | null>;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  // Drag state refs
  clipDragStateRef: React.MutableRefObject<ClipDragState>;
  trackReorderStateRef: React.MutableRefObject<TrackReorderState>;
  dropTrackIndexRef: React.MutableRefObject<number | null>;
  pointerClientRef: React.MutableRefObject<{ x: number; y: number } | null>;
  autoScrollRafRef: React.MutableRefObject<number | null>;
  autoScrollDriverRef: React.MutableRefObject<(() => void) | null>;
  suppressClickUntilRef: React.MutableRefObject<number>;
  moveDragActivatedRef: React.MutableRefObject<boolean>;
  clipMovePreviewRef: React.MutableRefObject<ClipMovePreviewState>;
  clipTimingPreviewRef: React.MutableRefObject<ClipTimingPreviewState>;
  // State setters
  setDropTrackIndex: (v: number | null) => void;
  setClipMovePreview: (v: ClipMovePreviewState) => void;
  setClipTimingPreview: (v: ClipTimingPreviewState) => void;
  setDraggingClipId: (v: string | null) => void;
  setDraggingClipMode: (v: ClipDragMode) => void;
  setClipGhost: (v: ClipGhostState) => void;
  setDragGhost: (v: DragGhostState) => void;
  setDraggingTrackIndex: (v: number | null) => void;
  // Data
  layerTracks: TimelineTrackModel[];
  totalW: number;
  durationSeconds: number;
  snapPoints: number[];
  // Callbacks
  onSelectionChange: (selection: TimelineSelection, options?: { additive?: boolean }) => void;
  onReorderTracks: (fromIndex: number, toIndex: number) => void;
  onClipTimingChange: (clipId: string, timing: { start: number; end: number }) => void;
  onCommitClipMove: (move: { clipId: string; start: number; end: number; targetLayer?: number }) => void;
  onPlayheadChange: (v: number) => void;
};

export function useTimelineDrag({
  scrollRef, trackAreaRef, rowRefs,
  clipDragStateRef, trackReorderStateRef, dropTrackIndexRef,
  pointerClientRef, autoScrollRafRef, autoScrollDriverRef,
  suppressClickUntilRef, moveDragActivatedRef,
  clipMovePreviewRef, clipTimingPreviewRef,
  setDropTrackIndex, setClipMovePreview, setClipTimingPreview,
  setDraggingClipId, setDraggingClipMode, setClipGhost, setDragGhost, setDraggingTrackIndex,
  layerTracks, totalW, durationSeconds, snapPoints,
  onSelectionChange, onReorderTracks, onClipTimingChange, onCommitClipMove, onPlayheadChange,
}: UseTimelineDragProps) {

  function suppressPostDragClick() {
    suppressClickUntilRef.current = performance.now() + 220;
  }

  const shouldSuppressClick = useCallback(() => {
    return performance.now() < suppressClickUntilRef.current;
  }, [suppressClickUntilRef]);

  function syncDropTrackIndex(nextTrackIndex: number | null) {
    dropTrackIndexRef.current = nextTrackIndex;
    setDropTrackIndex(nextTrackIndex);
  }

  function syncClipMovePreview(nextPreview: ClipMovePreviewState) {
    clipMovePreviewRef.current = nextPreview;
    setClipMovePreview(nextPreview);
  }

  function syncClipTimingPreview(nextPreview: ClipTimingPreviewState) {
    clipTimingPreviewRef.current = nextPreview;
    setClipTimingPreview(nextPreview);
  }

  function getLayerRowGeometry(): LayerRowGeometry[] {
    return layerTracks.flatMap((_, trackIndex) => {
      const node = rowRefs.current[`layer-${trackIndex}`];
      if (!node) return [];
      const rect = node.getBoundingClientRect();
      return [{ trackIndex, top: rect.top, bottom: rect.bottom, height: rect.height }];
    });
  }

  function snap(value: number, threshold = 0.01) {
    for (const point of snapPoints) {
      if (Math.abs(value - point) < threshold) return { value: point, snapped: true };
    }
    return { value, snapped: false };
  }

  function detectDropTrackIndex(clientY: number) {
    const geometry = getLayerRowGeometry();
    return resolveLayerTrackIndexFromPointer(clientY, geometry);
  }

  function getEdgeScrollStep(distanceToEdge: number) {
    const ratio = Math.max(0, Math.min(1, 1 - distanceToEdge / EDGE_SCROLL_THRESHOLD));
    return Math.round(ratio * EDGE_SCROLL_MAX_STEP);
  }

  function getAutoScrollVelocity() {
    const scroll = scrollRef.current;
    const pointer = pointerClientRef.current;
    if (!scroll || !pointer) return 0;
    const rect = scroll.getBoundingClientRect();
    const leftDist = pointer.x - rect.left;
    const rightDist = rect.right - pointer.x;
    if (leftDist < EDGE_SCROLL_THRESHOLD) return -getEdgeScrollStep(leftDist);
    if (rightDist < EDGE_SCROLL_THRESHOLD) return getEdgeScrollStep(rightDist);
    return 0;
  }

  function stopAutoScroll() {
    if (autoScrollRafRef.current != null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    autoScrollDriverRef.current = null;
  }

  function startAutoScroll(driver: () => void) {
    stopAutoScroll();
    autoScrollDriverRef.current = driver;
    function loop() {
      const velocity = getAutoScrollVelocity();
      if (velocity !== 0 && scrollRef.current) {
        scrollRef.current.scrollLeft += velocity;
        driver();
      }
      autoScrollRafRef.current = requestAnimationFrame(loop);
    }
    autoScrollRafRef.current = requestAnimationFrame(loop);
  }

  function resetDragVisualState() {
    setDraggingClipId(null);
    setDraggingClipMode(null);
    setDragGhost(null);
    setClipGhost(null);
    setDraggingTrackIndex(null);
    syncDropTrackIndex(null);
    syncClipMovePreview(null);
    syncClipTimingPreview(null);
    stopAutoScroll();
  }

  function updatePlayheadFromPointer(clientX: number) {
    const trackArea = trackAreaRef.current;
    if (!trackArea) return;
    const rect = trackArea.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const rawProgress = (clientX - rect.left + scrollLeft) / Math.max(totalW, 1);
    onPlayheadChange(clampProgress(rawProgress));
  }

  function handlePlayheadPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePlayheadFromPointer(e.clientX);

    function onMove(ev: PointerEvent) {
      updatePlayheadFromPointer(ev.clientX);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function updateClipDragFromPointer(clientX: number, clientY: number) {
    const state = clipDragStateRef.current;
    if (!state) return;

    const scroll = scrollRef.current;
    const scrollDelta = (scroll?.scrollLeft ?? 0) - state.startScrollLeft;
    const dx = clientX - state.startX + scrollDelta;
    const dy = clientY - state.startY;

    if (!moveDragActivatedRef.current) {
      if (Math.abs(dx) < DRAG_START_THRESHOLD && Math.abs(dy) < DRAG_START_THRESHOLD) return;
      moveDragActivatedRef.current = true;
      if (state.type === "move") {
        setDraggingClipId(state.clipId);
        setDraggingClipMode("move");
        activateClipMoveDrag(state.clipId, state.trackType, state.layerTrackIndex);
      } else {
        setDraggingClipId(state.clipId);
        setDraggingClipMode(state.type);
      }
    }

    if (state.type === "move") {
      const progressDelta = dx / Math.max(totalW, 1);
      const rawStart = clampProgress(state.initialStart + progressDelta);
      const rawEnd = clampProgress(state.initialEnd + progressDelta);
      const duration = state.initialEnd - state.initialStart;
      const { value: snappedStart, snapped } = snap(rawStart);
      const start = snapped ? snappedStart : rawStart;
      const end = clampProgress(start + duration);

      const targetLayerIndex = typeof state.layerTrackIndex === "number"
        ? detectDropTrackIndex(clientY) ?? state.layerTrackIndex
        : state.layerTrackIndex;

      const geometry = getLayerRowGeometry();
      const targetTrack = typeof targetLayerIndex === "number" ? layerTracks[targetLayerIndex] : undefined;
      const existingClips = targetTrack?.clips.filter((c) => c.id !== state.clipId) ?? [];
      const targetIndex = getClipInsertionIndex(start, existingClips, state.clipId);
      const isCrossLayer = targetLayerIndex !== state.layerTrackIndex;

      syncClipMovePreview({
        draggedClipId: state.clipId,
        sourceTrackIndex: state.layerTrackIndex ?? 0,
        sourceLayerId: state.layerTrackIndex ?? null,
        targetTrackIndex: targetLayerIndex ?? state.layerTrackIndex ?? 0,
        targetLayerId: targetLayerIndex ?? null,
        targetStart: start,
        targetEnd: end,
        targetIndex,
        isCrossLayerMove: isCrossLayer,
        isSnapped: snapped,
      });

      const trackAreaRect = trackAreaRef.current?.getBoundingClientRect();
      const ghostPos =
        trackAreaRect && scroll
          ? getLayerDragGhostPosition({
              clientX,
              clientY,
              containerRect: {
                left: trackAreaRect.left,
                top: trackAreaRect.top,
                width: trackAreaRect.width,
                height: trackAreaRect.height,
              },
              scrollLeft: scroll.scrollLeft,
              scrollTop: scroll.scrollTop,
              pointerOffsetX: 0,
              pointerOffsetY: geometry[0]?.height ? geometry[0].height / 2 : 20,
              ghostWidth: Math.max(18, duration * totalW),
              ghostHeight: geometry[0]?.height ?? 56,
            })
          : null;
      if (ghostPos) {
        const clip = layerTracks.flatMap((t) => t.clips).find((c) => c.id === state.clipId);
        setClipGhost({
          label: clip?.label ?? state.clipId,
          top: ghostPos.top,
          left: ghostPos.left,
          width: Math.max(18, duration * totalW),
          contentType: clip?.metadata?.contentType,
          transitionLabel: clip?.metadata?.transitionPreset?.replace(/-/g, " ") ?? null,
        });
      }
      syncDropTrackIndex(targetLayerIndex ?? null);
    } else {
      // Resize
      const progressDelta = dx / Math.max(totalW, 1);
      const MIN_CLIP_PROGRESS = 0.04;
      if (state.type === "resize-start") {
        const rawStart = clampProgress(state.initialStart + progressDelta);
        const { value: start } = snap(rawStart);
        const end = Math.max(start + MIN_CLIP_PROGRESS, state.initialEnd);
        syncClipTimingPreview({ clipId: state.clipId, start, end });
      } else {
        const rawEnd = clampProgress(state.initialEnd + progressDelta);
        const { value: end } = snap(rawEnd);
        const start = Math.min(end - MIN_CLIP_PROGRESS, state.initialStart);
        syncClipTimingPreview({ clipId: state.clipId, start, end });
      }
    }
  }

  function updateTrackGhostPosition(clientX: number, clientY: number) {
    const state = trackReorderStateRef.current;
    const scroll = scrollRef.current;
    if (!state || !scroll) return;
    const scrollRect = scroll.getBoundingClientRect();
    const geometry = getLayerRowGeometry();
    const rowHeight = geometry[0]?.height ?? 56;
    setDragGhost({
      kind: "layer",
      label: layerTracks[state.fromIndex]?.label ?? `Layer ${state.fromIndex + 1}`,
      top: clientY - scrollRect.top - state.pointerOffsetY,
      left: scrollRect.left,
      width: scrollRect.width,
      height: rowHeight,
    });
  }

  function updateTrackReorderFromPointer(clientX: number, clientY: number) {
    const state = trackReorderStateRef.current;
    if (!state) return;
    const didDrag =
      Math.abs(clientX - state.startX) > DRAG_START_THRESHOLD ||
      Math.abs(clientY - state.startY) > DRAG_START_THRESHOLD;
    if (!didDrag) return;
    const targetIndex = detectDropTrackIndex(clientY);
    syncDropTrackIndex(targetIndex ?? null);
    setDraggingTrackIndex(state.fromIndex);
    updateTrackGhostPosition(clientX, clientY);
  }

  function activateClipMoveDrag(clipId: string, trackType: TimelineTrackType, layerTrackIndex?: number) {
    const clip = layerTracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return;
    syncClipMovePreview({
      draggedClipId: clipId,
      sourceTrackIndex: layerTrackIndex ?? 0,
      sourceLayerId: layerTrackIndex ?? null,
      targetTrackIndex: layerTrackIndex ?? 0,
      targetLayerId: layerTrackIndex ?? null,
      targetStart: clip.start,
      targetEnd: clip.end,
      targetIndex: getClipInsertionIndex(clip.start, layerTracks[layerTrackIndex ?? 0]?.clips ?? [], clipId),
      isCrossLayerMove: false,
      isSnapped: false,
    });
  }

  const beginClipDrag = useCallback((
    e: React.MouseEvent,
    type: Exclude<ClipDragState, null>["type"],
    clip: TimelineClipModel,
    layerTrackIndex?: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectionChange(
      { clipId: clip.id, trackType: clip.trackType },
      { additive: e.metaKey || e.ctrlKey },
    );

    clipDragStateRef.current = {
      type,
      clipId: clip.id,
      trackType: clip.trackType,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      initialStart: clip.start,
      initialEnd: clip.end,
      layerTrackIndex,
    };
    moveDragActivatedRef.current = false;
    if (type === "move") {
      setDraggingClipId(null);
      setDraggingClipMode(null);
    }

    function handleMove(ev: MouseEvent) {
      pointerClientRef.current = { x: ev.clientX, y: ev.clientY };
      updateClipDragFromPointer(ev.clientX, ev.clientY);
      startAutoScroll(() => updateClipDragFromPointer(
        pointerClientRef.current?.x ?? ev.clientX,
        pointerClientRef.current?.y ?? ev.clientY,
      ));
    }

    function handleUp() {
      const state = clipDragStateRef.current;
      const didDrag = moveDragActivatedRef.current;
      if (didDrag && state) {
        if (state.type === "move") {
          const preview = clipMovePreviewRef.current;
          if (preview) {
            onCommitClipMove({
              clipId: state.clipId,
              start: preview.targetStart,
              end: preview.targetEnd,
              targetLayer: preview.targetLayerId ?? undefined,
            });
          }
        } else {
          const preview = clipTimingPreviewRef.current;
          if (preview) {
            onClipTimingChange(state.clipId, { start: preview.start, end: preview.end });
          }
        }
        suppressPostDragClick();
      }
      clipDragStateRef.current = null;
      moveDragActivatedRef.current = false;
      resetDragVisualState();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [onSelectionChange]);

  const beginTrackReorder = useCallback((e: React.MouseEvent, fromIndex: number) => {
    e.preventDefault();
    const geometry = getLayerRowGeometry();
    const rowGeom = geometry[fromIndex];
    const pointerOffsetY = rowGeom ? e.clientY - rowGeom.top : 0;
    trackReorderStateRef.current = {
      fromIndex,
      pointerOffsetX: 0,
      pointerOffsetY,
      startX: e.clientX,
      startY: e.clientY,
    };

    function handleMove(ev: MouseEvent) {
      pointerClientRef.current = { x: ev.clientX, y: ev.clientY };
      updateTrackReorderFromPointer(ev.clientX, ev.clientY);
    }

    function handleUp() {
      const state = trackReorderStateRef.current;
      const didDrag =
        state &&
        (Math.abs((pointerClientRef.current?.x ?? 0) - state.startX) > DRAG_START_THRESHOLD ||
          Math.abs((pointerClientRef.current?.y ?? 0) - state.startY) > DRAG_START_THRESHOLD);

      if (
        didDrag &&
        state &&
        dropTrackIndexRef.current !== null &&
        dropTrackIndexRef.current !== state.fromIndex
      ) {
        onReorderTracks(state.fromIndex, dropTrackIndexRef.current);
      }
      if (didDrag) suppressPostDragClick();
      trackReorderStateRef.current = null;
      resetDragVisualState();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [onReorderTracks]);

  return {
    shouldSuppressClick,
    beginClipDrag,
    beginTrackReorder,
    handlePlayheadPointerDown,
    syncDropTrackIndex,
  };
}
