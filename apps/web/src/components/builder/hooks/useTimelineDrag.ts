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

import { useCallback, useRef } from "react";
import { clampProgress } from "@motionroll/shared";
import { TIMELINE_START_OFFSET } from "../timeline-layout";
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
  onClipTimingChange: (
    clipId: string,
    timing: { start: number; end: number },
    options?: { dragMode?: "move" | "resize-start" | "resize-end" },
  ) => void;
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
  const playheadScrubCleanupRef = useRef<(() => void) | null>(null);
  const autoScrollBoundsRef = useRef<{ maxScrollLeft: number; maxScrollTop: number } | null>(null);

  function disableDocumentSelection() {
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }

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
    if (!scroll || !pointer) return { x: 0, y: 0 };
    const rect = scroll.getBoundingClientRect();
    const leftDist = pointer.x - rect.left;
    const rightDist = rect.right - pointer.x;
    const topDist = pointer.y - rect.top;
    const bottomDist = rect.bottom - pointer.y;
    return {
      x:
        leftDist < EDGE_SCROLL_THRESHOLD
          ? -getEdgeScrollStep(leftDist)
          : rightDist < EDGE_SCROLL_THRESHOLD
            ? getEdgeScrollStep(rightDist)
            : 0,
      y:
        topDist < EDGE_SCROLL_THRESHOLD
          ? -getEdgeScrollStep(topDist)
          : bottomDist < EDGE_SCROLL_THRESHOLD
            ? getEdgeScrollStep(bottomDist)
            : 0,
    };
  }

  function stopAutoScroll() {
    if (autoScrollRafRef.current != null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    autoScrollDriverRef.current = null;
    autoScrollBoundsRef.current = null;
  }

  function startAutoScroll(driver: () => void) {
    if (autoScrollDriverRef.current === driver && autoScrollRafRef.current != null) {
      return;
    }
    stopAutoScroll();
    const scroll = scrollRef.current;
    autoScrollBoundsRef.current = scroll
      ? {
          maxScrollLeft: Math.max(0, scroll.scrollWidth - scroll.clientWidth),
          maxScrollTop: Math.max(0, scroll.scrollHeight - scroll.clientHeight),
        }
      : null;
    autoScrollDriverRef.current = driver;
    function loop() {
      const velocity = getAutoScrollVelocity();
      if ((velocity.x !== 0 || velocity.y !== 0) && scrollRef.current) {
        const scroll = scrollRef.current;
        const bounds = autoScrollBoundsRef.current ?? {
          maxScrollLeft: Math.max(0, scroll.scrollWidth - scroll.clientWidth),
          maxScrollTop: Math.max(0, scroll.scrollHeight - scroll.clientHeight),
        };
        const nextScrollLeft = Math.max(0, Math.min(bounds.maxScrollLeft, scroll.scrollLeft + velocity.x));
        const nextScrollTop = Math.max(0, Math.min(bounds.maxScrollTop, scroll.scrollTop + velocity.y));
        const didScroll = nextScrollLeft !== scroll.scrollLeft || nextScrollTop !== scroll.scrollTop;
        if (didScroll) {
          scroll.scrollLeft = nextScrollLeft;
          scroll.scrollTop = nextScrollTop;
          driver();
        }
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
    const rawProgress =
      (clientX - rect.left - TIMELINE_START_OFFSET) / Math.max(totalW, 1);
    onPlayheadChange(clampProgress(rawProgress));
  }

  function handlePlayheadPointerDown(e: React.PointerEvent) {
    // If a previous scrub session did not cleanly terminate (e.g. edge-case pointer cancel),
    // force-clean it before starting a new one so the ruler never gets "stuck".
    playheadScrubCleanupRef.current?.();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers can throw if capture is unavailable; window listeners still handle drag.
    }
    updatePlayheadFromPointer(e.clientX);
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    function onPointerMove(ev: PointerEvent) {
      updatePlayheadFromPointer(ev.clientX);
    }

    function onMouseMove(ev: MouseEvent) {
      updatePlayheadFromPointer(ev.clientX);
    }

    function cleanup() {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", cleanup);
      window.removeEventListener("blur", cleanup);
      playheadScrubCleanupRef.current = null;
    }

    playheadScrubCleanupRef.current = cleanup;

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    // Fallback for environments where pointermove can drop at viewport edges.
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", cleanup);
    window.addEventListener("blur", cleanup);
  }

  function updateClipDragFromPointer(clientX: number, clientY: number) {
    const state = clipDragStateRef.current;
    if (!state) return;
    const clip = layerTracks.flatMap((track) => track.clips).find((entry) => entry.id === state.clipId);
    const sceneBoundsStart = clip?.metadata?.bookmarkStartProgress ?? 0;
    const sceneBoundsEnd = clip?.metadata?.bookmarkEndProgress ?? 1;

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
      const sceneWidth = Math.max(sceneBoundsEnd - sceneBoundsStart, 0);
      const duration = Math.min(state.initialEnd - state.initialStart, sceneWidth);
      const maxStart = Math.max(sceneBoundsEnd - duration, sceneBoundsStart);
      const boundedStart = Math.min(
        Math.max(state.initialStart + progressDelta, sceneBoundsStart),
        maxStart,
      );
      const rawStart = clampProgress(boundedStart);
      const { value: snappedStart, snapped } = snap(rawStart);
      let start = Math.min(
        Math.max(snapped ? snappedStart : rawStart, sceneBoundsStart),
        maxStart,
      );
      let end = Math.min(start + duration, sceneBoundsEnd);
      if (end - start < duration) {
        start = Math.max(sceneBoundsStart, sceneBoundsEnd - duration);
        end = Math.min(start + duration, sceneBoundsEnd);
      }
      start = clampProgress(start);
      end = clampProgress(end);

      const targetLayerIndex = typeof state.layerTrackIndex === "number"
        ? detectDropTrackIndex(clientY) ?? state.layerTrackIndex
        : state.layerTrackIndex;

      const geometry = getLayerRowGeometry();
      const targetTrack = typeof targetLayerIndex === "number" ? layerTracks[targetLayerIndex] : undefined;
      const sourceTrack = typeof state.layerTrackIndex === "number"
        ? layerTracks[state.layerTrackIndex]
        : undefined;
      const existingClips = targetTrack?.clips.filter((c) => c.id !== state.clipId) ?? [];
      const targetIndex = getClipInsertionIndex(start, existingClips, state.clipId);
      const isCrossLayer = targetLayerIndex !== state.layerTrackIndex;

      syncClipMovePreview({
        draggedClipId: state.clipId,
        sourceTrackIndex: state.layerTrackIndex ?? 0,
        sourceLayerId: sourceTrack?.metadata?.layerIndex ?? null,
        targetTrackIndex: targetLayerIndex ?? state.layerTrackIndex ?? 0,
        targetLayerId: targetTrack?.metadata?.layerIndex ?? null,
        targetStart: start,
        targetEnd: end,
        targetIndex,
        isCrossLayerMove: isCrossLayer,
        isSnapped: snapped,
      });

      const scrollRect = scroll?.getBoundingClientRect();
      const ghostPos =
        scroll && scrollRect
          ? getLayerDragGhostPosition({
              clientX,
              clientY,
              containerRect: {
                left: scrollRect.left,
                top: scrollRect.top,
                width: scrollRect.width,
                height: scrollRect.height,
              },
              scrollLeft: scroll.scrollLeft,
              scrollTop: scroll.scrollTop,
              pointerOffsetX: state.pointerOffsetX,
              pointerOffsetY: state.pointerOffsetY,
              ghostWidth: Math.max(18, duration * totalW),
              ghostHeight: 40,
            })
          : null;
      if (ghostPos) {
        setClipGhost({
          label: clip?.label ?? state.clipId,
          top: ghostPos.top,
          left: ghostPos.left,
          width: Math.max(18, duration * totalW),
          contentType: clip?.metadata?.contentType,
        });
      }
      syncDropTrackIndex(targetLayerIndex ?? null);
    } else {
      // Resize
      const progressDelta = dx / Math.max(totalW, 1);
      const MIN_CLIP_PROGRESS = 0.04;
      if (state.type === "resize-start") {
        const rawStart = clampProgress(
          Math.min(
            Math.max(state.initialStart + progressDelta, sceneBoundsStart),
            state.initialEnd - MIN_CLIP_PROGRESS,
          ),
        );
        const { value: start } = snap(rawStart);
        syncClipTimingPreview({
          clipId: state.clipId,
          start: Math.min(Math.max(start, sceneBoundsStart), state.initialEnd - MIN_CLIP_PROGRESS),
          end: state.initialEnd,
        });
      } else {
        const rawEnd = clampProgress(
          Math.max(
            Math.min(state.initialEnd + progressDelta, sceneBoundsEnd),
            state.initialStart + MIN_CLIP_PROGRESS,
          ),
        );
        const { value: end } = snap(rawEnd);
        syncClipTimingPreview({
          clipId: state.clipId,
          start: state.initialStart,
          end: Math.max(Math.min(end, sceneBoundsEnd), state.initialStart + MIN_CLIP_PROGRESS),
        });
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
    const ghostPos = getLayerDragGhostPosition({
      clientX,
      clientY,
      containerRect: {
        left: scrollRect.left,
        top: scrollRect.top,
        width: scrollRect.width,
        height: scrollRect.height,
      },
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
      pointerOffsetX: state.pointerOffsetX,
      pointerOffsetY: state.pointerOffsetY,
      ghostWidth: scroll.clientWidth,
      ghostHeight: rowHeight,
    });
    setDragGhost({
      kind: "layer",
      label: layerTracks[state.fromIndex]?.label ?? `Layer ${state.fromIndex + 1}`,
      top: ghostPos.top,
      left: ghostPos.left,
      width: scroll.clientWidth,
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
    const sourceTrack = typeof layerTrackIndex === "number" ? layerTracks[layerTrackIndex] : undefined;
    syncClipMovePreview({
      draggedClipId: clipId,
      sourceTrackIndex: layerTrackIndex ?? 0,
      sourceLayerId: sourceTrack?.metadata?.layerIndex ?? null,
      targetTrackIndex: layerTrackIndex ?? 0,
      targetLayerId: sourceTrack?.metadata?.layerIndex ?? null,
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
      pointerOffsetX: e.clientX - e.currentTarget.getBoundingClientRect().left,
      pointerOffsetY: e.clientY - e.currentTarget.getBoundingClientRect().top,
      layerTrackIndex,
    };
    moveDragActivatedRef.current = false;
    if (type === "move") {
      setDraggingClipId(null);
      setDraggingClipMode(null);
    }
    const restoreSelection = disableDocumentSelection();
    const dragAutoScrollDriver = () =>
      updateClipDragFromPointer(
        pointerClientRef.current?.x ?? e.clientX,
        pointerClientRef.current?.y ?? e.clientY,
      );

    function handleMove(ev: MouseEvent) {
      pointerClientRef.current = { x: ev.clientX, y: ev.clientY };
      updateClipDragFromPointer(ev.clientX, ev.clientY);
    }

    pointerClientRef.current = { x: e.clientX, y: e.clientY };
    startAutoScroll(dragAutoScrollDriver);
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
            onClipTimingChange(
              state.clipId,
              { start: preview.start, end: preview.end },
              { dragMode: state.type },
            );
          }
        }
        suppressPostDragClick();
      }
      clipDragStateRef.current = null;
      moveDragActivatedRef.current = false;
      resetDragVisualState();
      restoreSelection();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [onSelectionChange]);

  const beginTrackReorder = useCallback((e: React.MouseEvent, fromIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const scroll = scrollRef.current;
    const geometry = getLayerRowGeometry();
    const rowGeom = geometry[fromIndex];
    const scrollRect = scroll?.getBoundingClientRect();
    const pointerOffsetY = rowGeom ? e.clientY - rowGeom.top : 0;
    trackReorderStateRef.current = {
      fromIndex,
      pointerOffsetX: scrollRect ? e.clientX - scrollRect.left : 0,
      pointerOffsetY,
      startX: e.clientX,
      startY: e.clientY,
    };
    const restoreSelection = disableDocumentSelection();
    const trackAutoScrollDriver = () =>
      updateTrackReorderFromPointer(
        pointerClientRef.current?.x ?? e.clientX,
        pointerClientRef.current?.y ?? e.clientY,
      );

    function handleMove(ev: MouseEvent) {
      pointerClientRef.current = { x: ev.clientX, y: ev.clientY };
      updateTrackReorderFromPointer(ev.clientX, ev.clientY);
    }

    pointerClientRef.current = { x: e.clientX, y: e.clientY };
    startAutoScroll(trackAutoScrollDriver);
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
      restoreSelection();
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
