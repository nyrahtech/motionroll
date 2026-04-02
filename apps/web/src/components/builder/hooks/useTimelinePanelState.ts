"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collectSnapPoints,
  getTimelineFrameStripForProgressRange,
  getTimelineTrackWidth,
  TIMELINE_ADD_BLOCK_PX,
} from "../timeline-model";
import type {
  ClipDragMode,
  ClipDragState,
  ClipGhostState,
  ClipMovePreviewState,
  ClipTimingPreviewState,
  DragGhostState,
  TrackReorderState,
} from "../timeline-types";
import { useTimelineDrag } from "./useTimelineDrag";
import {
  getFrameStripSampleCount,
  getLayerRowDescriptors,
  LABEL_W,
  PLAYHEAD_SCROLL_PADDING,
} from "../timeline-panel-utils";
import { TIMELINE_START_OFFSET } from "../timeline-layout";
import type { TimelinePanelProps, TimelinePanelState } from "../timeline-panel.types";

export function useTimelinePanelState(props: Pick<
  TimelinePanelProps,
  | "tracks"
  | "playback"
  | "durationSeconds"
  | "selection"
  | "onSelectionChange"
  | "onReorderTracks"
  | "onClipTimingChange"
  | "onCommitClipMove"
  | "onPlayheadChange"
  | "onDeleteLayer"
>) : TimelinePanelState {
  const {
    tracks,
    playback,
    durationSeconds,
    selection,
    onSelectionChange,
    onReorderTracks,
    onClipTimingChange,
    onCommitClipMove,
    onPlayheadChange,
    onDeleteLayer,
  } = props;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackAreaRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const clipDragStateRef = useRef<ClipDragState>(null);
  const trackReorderStateRef = useRef<TrackReorderState>(null);
  const dropTrackIndexRef = useRef<number | null>(null);
  const pointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const autoScrollDriverRef = useRef<(() => void) | null>(null);
  const suppressClickUntilRef = useRef(0);
  const moveDragActivatedRef = useRef(false);
  const clipMovePreviewRef = useRef<ClipMovePreviewState>(null);
  const clipTimingPreviewRef = useRef<ClipTimingPreviewState>(null);
  const [dropTrackIndex, setDropTrackIndex] = useState<number | null>(null);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [draggingClipMode, setDraggingClipMode] = useState<ClipDragMode>(null);
  const [draggingTrackIndex, setDraggingTrackIndex] = useState<number | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhostState>(null);
  const [clipGhost, setClipGhost] = useState<ClipGhostState>(null);
  const [clipMovePreview, setClipMovePreview] = useState<ClipMovePreviewState>(null);
  const [clipTimingPreview, setClipTimingPreview] = useState<ClipTimingPreviewState>(null);
  const [recentlyAddedTrackId, setRecentlyAddedTrackId] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const previousLayerTrackIdsRef = useRef<string[]>([]);

  const totalW = getTimelineTrackWidth(durationSeconds);
  const totalTrackW = totalW + TIMELINE_START_OFFSET + TIMELINE_ADD_BLOCK_PX;
  const bookmarkTrack = tracks.find((track) => track.type === "section");
  const layerTracks = tracks.filter((track) => track.type === "layer");
  const draggedClip = draggingClipId
    ? layerTracks.flatMap((track) => track.clips).find((clip) => clip.id === draggingClipId)
    : undefined;

  const snapPoints = useMemo(
    () => collectSnapPoints(layerTracks, draggingClipId ?? undefined),
    [layerTracks, draggingClipId],
  );

  const frameStripCache = useMemo(() => {
    const cache = new Map<string, string[]>();
    for (const track of tracks) {
      for (const clip of track.clips) {
        const previewTiming = clipTimingPreview?.clipId === clip.id ? clipTimingPreview : null;
        const clipStart = previewTiming?.start ?? clip.start;
        const clipEnd = previewTiming?.end ?? clip.end;
        const width = Math.max(14, (clipEnd - clipStart) * totalW);
        const sampleCount = getFrameStripSampleCount(
          width,
          clip.metadata?.frameStripSource?.frameCount,
          clipStart,
          clipEnd,
        );
        const frameStrip = clip.metadata?.frameStripSource
          ? getTimelineFrameStripForProgressRange(
              clip.metadata.frameStripSource,
              clipStart,
              clipEnd,
              sampleCount,
            )
          : clip.metadata?.frameStrip;
        if (frameStrip?.length) {
          cache.set(clip.id, frameStrip);
        }
      }
    }
    return cache;
  }, [clipTimingPreview, totalW, tracks]);

  useEffect(() => {
    const syncScrollToPlayhead = () => {
      const scroll = scrollRef.current;
      if (!scroll) return;

      const trackViewportWidth = Math.max(scroll.clientWidth - LABEL_W, 1);
      const maxScrollLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
      const playheadX = TIMELINE_START_OFFSET + playback.getPlayhead() * totalW;
      const visibleStart = scroll.scrollLeft;
      const visibleEnd = visibleStart + trackViewportWidth;

      if (playheadX <= visibleStart + PLAYHEAD_SCROLL_PADDING) {
        scroll.scrollLeft = Math.max(0, playheadX - PLAYHEAD_SCROLL_PADDING);
        return;
      }

      if (playheadX >= visibleEnd - PLAYHEAD_SCROLL_PADDING) {
        scroll.scrollLeft = Math.min(
          maxScrollLeft,
          playheadX - trackViewportWidth + PLAYHEAD_SCROLL_PADDING,
        );
      }
    };

    syncScrollToPlayhead();
    return playback.subscribe(syncScrollToPlayhead);
  }, [playback, totalW]);

  useEffect(() => {
    const previousIds = previousLayerTrackIdsRef.current;
    const nextIds = layerTracks.map((track) => track.id);
    if (previousIds.length === 0) {
      previousLayerTrackIdsRef.current = nextIds;
      return;
    }
    const addedTrackId = nextIds.find((id) => !previousIds.includes(id));
    if (addedTrackId) {
      setRecentlyAddedTrackId(addedTrackId);
      const timeoutId = window.setTimeout(
        () => setRecentlyAddedTrackId((current) => current === addedTrackId ? null : current),
        480,
      );
      previousLayerTrackIdsRef.current = nextIds;
      return () => window.clearTimeout(timeoutId);
    }
    previousLayerTrackIdsRef.current = nextIds;
  }, [layerTracks]);

  const {
    shouldSuppressClick,
    beginClipDrag,
    beginTrackReorder,
    handlePlayheadPointerDown,
  } = useTimelineDrag({
    scrollRef, trackAreaRef, rowRefs,
    clipDragStateRef, trackReorderStateRef, dropTrackIndexRef,
    pointerClientRef, autoScrollRafRef, autoScrollDriverRef,
    suppressClickUntilRef, moveDragActivatedRef, clipMovePreviewRef, clipTimingPreviewRef,
    setDropTrackIndex, setClipMovePreview, setClipTimingPreview,
    setDraggingClipId, setDraggingClipMode, setClipGhost, setDragGhost, setDraggingTrackIndex,
    layerTracks, totalW, durationSeconds, snapPoints,
    onSelectionChange, onReorderTracks, onClipTimingChange, onCommitClipMove, onPlayheadChange,
  });

  const handleDeleteLayerWithAnimation = useCallback((trackId: string, originalIndex: number) => {
    setDeletingTrackId(trackId);
    window.setTimeout(() => {
      onDeleteLayer(originalIndex);
      setDeletingTrackId((current) => current === trackId ? null : current);
    }, 140);
  }, [onDeleteLayer]);

  const layerRowDescriptors = useMemo(
    () =>
      getLayerRowDescriptors({
        layerTracks,
        dropTrackIndex,
        draggingTrackIndex,
        dragGhost,
        draggingClipMode,
        draggingClipId,
        clipMovePreview,
        recentlyAddedTrackId,
        deletingTrackId,
        durationSeconds,
        totalW,
      }),
    [
      clipMovePreview,
      deletingTrackId,
      dragGhost,
      draggingClipId,
      draggingClipMode,
      draggingTrackIndex,
      dropTrackIndex,
      durationSeconds,
      layerTracks,
      recentlyAddedTrackId,
      totalW,
    ],
  );

  return {
    scrollRef,
    trackAreaRef,
    rowRefs,
    bookmarkTrack,
    layerTracks,
    totalW,
    totalTrackW,
    frameStripCache,
    draggedClip,
    draggingClipId,
    draggingClipMode,
    draggingTrackIndex,
    dragGhost,
    clipGhost,
    clipTimingPreview,
    layerRowDescriptors,
    shouldSuppressClick,
    beginClipDrag,
    beginTrackReorder,
    handlePlayheadPointerDown,
    handleDeleteLayerWithAnimation,
  };
}
