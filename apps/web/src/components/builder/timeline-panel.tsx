"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers3,
  RotateCcw,
  RotateCw,
  GripVertical,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Ungroup,
} from "lucide-react";
import { clampProgress, progressToFrameBoundaryIndex, type OverlayAnimationType } from "@motionroll/shared";
import { collectSnapPoints, getTimelineFrameStripForProgressRange, getTimelineTimeLabel, type TimelineClipModel, type TimelineSelection, type TimelineTrackModel, type TimelineTrackType } from "./timeline-model";
import type {
  ClipDragMode,
  ClipDragState,
  ClipGhostState,
  ClipMovePreviewState,
  ClipTimingPreviewState,
  DragGhostState,
  TrackReorderState,
} from "./timeline-types";
import { getClipInsertionIndex, getLayerDragGhostPosition, resolveLayerTrackIndexFromPointer, type LayerRowGeometry } from "./timeline-drag-preview";
import { useTimelineDrag } from "./hooks/useTimelineDrag";
import { TimelineRuler } from "./timeline/TimelineRuler";
import { TimelinePlayhead } from "./timeline/TimelinePlayhead";
import { TimelineScrollArea } from "./timeline/TimelineScrollArea";
import { TimelineTrackRow } from "./timeline/TimelineTrackRow";
import { TimelineLayerLabel } from "./timeline/TimelineLayerLabel";
import type { EditorPlaybackController } from "./hooks/useEditorPlayback";
import { usePlaybackProgress } from "./hooks/useEditorPlayback";
import { TIMELINE_START_OFFSET } from "./timeline-layout";

type TimelinePanelProps = {
  tracks: TimelineTrackModel[];
  selection: TimelineSelection;
  selectedClipIds: string[];
  playback: EditorPlaybackController;
  durationSeconds: number;
  isPlaying: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canGroupSelection: boolean;
  canUngroupSelection: boolean;
  onPlayToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  onPlayheadChange: (value: number) => void;
  onSelectionChange: (selection: TimelineSelection, options?: { additive?: boolean }) => void;
  onClipTimingChange: (clipId: string, timing: { start: number; end: number }) => void;
  onCommitClipMove: (move: { clipId: string; start: number; end: number; targetLayer?: number }) => void;
  onAddLayer: () => void;
  onDeleteLayer: (layerRowIndex: number) => void;
  onAddAtPlayhead: () => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onMoveClipToLayer: (clipId: string, layerIndex: number) => void;
  onMoveClipToNewLayer: (clipId: string) => void;
  onSetClipEnterAnimationType: (clipId: string, type: OverlayAnimationType) => void;
  onSetClipExitAnimationType: (clipId: string, type: OverlayAnimationType) => void;
  onSetSceneEnterTransitionPreset: (
    preset: "none" | "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve",
  ) => void;
  onSetSceneExitTransitionPreset: (
    preset: "none" | "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve",
  ) => void;
  onReorderTracks: (fromIndex: number, toIndex: number) => void;
};

// Drag and state types live in timeline-types.ts to avoid circular deps

const LABEL_W = 168;
const PX_PER_SEC = 118;
const MIN_CLIP_PROGRESS = 0.04;
const DRAG_START_THRESHOLD = 5;
const EDGE_SCROLL_THRESHOLD = 88;
const EDGE_SCROLL_MAX_STEP = 18;
const FRAME_STRIP_TARGET_TILE_WIDTH = 72;
const FRAME_STRIP_MIN_SAMPLES = 4;
const FRAME_STRIP_MAX_SAMPLES = 18;
const PLAYHEAD_SCROLL_PADDING = 96;

function isResizeMode(mode: ClipDragMode) {
  return mode === "resize-start" || mode === "resize-end";
}

function getFrameStripSampleCount(
  width: number,
  frameCount?: number,
  clipStart?: number,
  clipEnd?: number,
) {
  if (width < 180) {
    return 0;
  }
  const derivedSampleCount = Math.ceil(width / FRAME_STRIP_TARGET_TILE_WIDTH);
  const visibleFrameCount =
    typeof frameCount === "number" &&
    typeof clipStart === "number" &&
    typeof clipEnd === "number"
      ? Math.abs(
          progressToFrameBoundaryIndex(clipEnd, frameCount) -
            progressToFrameBoundaryIndex(clipStart, frameCount),
        ) + 1
      : 0;
  return Math.max(
    FRAME_STRIP_MIN_SAMPLES,
    Math.min(FRAME_STRIP_MAX_SAMPLES, Math.max(derivedSampleCount, visibleFrameCount)),
  );
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFrame(progress: number, durationSeconds: number) {
  const approxFrames = Math.max(1, Math.round(durationSeconds * 24));
  const frame = Math.min(approxFrames, Math.max(1, Math.round(progress * approxFrames) + 1));
  return `${frame} / ${approxFrames}`;
}

function TimelineControlButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

function PlaybackStrip({
  playback, duration, isPlaying, canUndo, canRedo, canGroupSelection, canUngroupSelection,
  onFrameChange, onTogglePlay, onUndo, onRedo, onGroupSelection, onUngroupSelection, onAddLayer,
}: {
  playback: EditorPlaybackController; duration: number; isPlaying: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canGroupSelection: boolean;
  canUngroupSelection: boolean;
  onFrameChange: (p: number) => void;
  onTogglePlay: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  onAddLayer: () => void;
}) {
  const playhead = usePlaybackProgress(playback);
  const currentSec = playhead * duration;
  const ib = "flex h-8 w-8 items-center justify-center rounded-md text-[var(--editor-text-dim)] transition-colors hover:bg-[var(--editor-hover)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[var(--editor-text-dim)]";
  return (
    <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}>
      <div className="flex min-w-0 items-center gap-1.5 justify-self-start">
        <TimelineControlButton label="Undo" onClick={onUndo} disabled={!canUndo} className={ib}>
          <RotateCcw className="h-4 w-4" />
        </TimelineControlButton>
        <TimelineControlButton label="Redo" onClick={onRedo} disabled={!canRedo} className={ib}>
          <RotateCw className="h-4 w-4" />
        </TimelineControlButton>
        <TimelineControlButton label="Add layer" onClick={onAddLayer} className={ib}>
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <Plus className="h-3 w-3" />
          </span>
        </TimelineControlButton>
        <TimelineControlButton
          label="Group selected items"
          onClick={onGroupSelection}
          disabled={!canGroupSelection}
          className={ib}
        >
          <Layers3 className="h-4 w-4" />
        </TimelineControlButton>
        <TimelineControlButton
          label="Ungroup selected item"
          onClick={onUngroupSelection}
          disabled={!canUngroupSelection}
          className={ib}
        >
          <Ungroup className="h-4 w-4" />
        </TimelineControlButton>
      </div>
      <div className="flex items-center gap-1 justify-self-center">
        <button type="button" aria-label="Jump to start" title="Jump to start" onClick={() => onFrameChange(0)} className={ib}><SkipBack className="h-4 w-4" /></button>
        <button type="button" aria-label="Previous frame" title="Previous frame" onClick={() => onFrameChange(Math.max(0, playhead - 1 / Math.max(duration * 24, 1)))} className={ib}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label={isPlaying ? "Pause playback" : "Start playback"} title={isPlaying ? "Pause playback" : "Start playback"} onClick={onTogglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--editor-selected)] text-[var(--editor-accent)] transition-colors hover:bg-[rgba(103,232,249,0.18)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <button type="button" aria-label="Next frame" title="Next frame" onClick={() => onFrameChange(Math.min(1, playhead + 1 / Math.max(duration * 24, 1)))} className={ib}><ChevronRight className="h-4 w-4" /></button>
        <button type="button" aria-label="Jump to end" title="Jump to end" onClick={() => onFrameChange(1)} className={ib}><SkipForward className="h-4 w-4" /></button>
      </div>
      <div className="flex min-w-0 items-center justify-self-end gap-2 text-xs tabular-nums" style={{ color: "var(--editor-text-dim)" }}>
        <span className="font-medium" style={{ color: "var(--editor-text)" }}>{formatTime(currentSec)}</span>
        <span>/ {formatTime(duration)}</span>
        <span className="ml-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(103,232,249,0.08)", color: "var(--editor-accent)" }}>
          frame {formatFrame(playhead, duration)}
        </span>
      </div>
    </div>
  );
}

export function TimelinePanel({
  tracks, selection, selectedClipIds, playback, durationSeconds, isPlaying, canUndo, canRedo,
  canGroupSelection, canUngroupSelection, onPlayToggle, onUndo, onRedo, onGroupSelection, onUngroupSelection, onPlayheadChange, onSelectionChange,
  onClipTimingChange, onCommitClipMove, onAddLayer, onDeleteLayer, onAddAtPlayhead, onDuplicateClip, onDeleteClip,
  onMoveClipToLayer,
  onMoveClipToNewLayer,
  onSetClipEnterAnimationType,
  onSetClipExitAnimationType,
  onSetSceneEnterTransitionPreset,
  onSetSceneExitTransitionPreset,
  onReorderTracks,
}: TimelinePanelProps) {
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
  const totalW = Math.max(960, Math.round(durationSeconds * PX_PER_SEC));
  const totalTrackW = totalW + TIMELINE_START_OFFSET;
  const sceneTrack = tracks.find((t) => t.type === "section");
  const layerTracks = tracks.filter((t) => t.type === "layer");
  const draggedClip = draggingClipId
    ? layerTracks.flatMap((track) => track.clips).find((clip) => clip.id === draggingClipId)
    : undefined;
  const snapPoints = React.useMemo(
    () => collectSnapPoints(layerTracks, draggingClipId ?? undefined),
    [layerTracks, draggingClipId],
  );
  const frameStripCache = React.useMemo(() => {
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
      const timeoutId = window.setTimeout(() => setRecentlyAddedTrackId((current) => current === addedTrackId ? null : current), 480);
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


  const layerRowDescriptors = React.useMemo(
    () => layerTracks.map((track, originalIndex) => {
      const isDropTarget = dropTrackIndex === originalIndex;
      const isDraggingRow = draggingTrackIndex === originalIndex;
      const isLayerReorderDrag = dragGhost !== null;
      const isBlockMoveDrag = draggingClipMode === "move" && draggingClipId !== null && !isLayerReorderDrag;
      const isRecentlyAdded = recentlyAddedTrackId === track.id;
      const isDeleting = deletingTrackId === track.id;
      const movePreviewForTrack =
        isBlockMoveDrag && clipMovePreview?.targetTrackIndex === originalIndex
          ? clipMovePreview
          : null;
      const previewLeft = movePreviewForTrack
        ? TIMELINE_START_OFFSET + movePreviewForTrack.targetStart * totalW
        : 0;
      const previewWidth = movePreviewForTrack
        ? Math.max(18, (movePreviewForTrack.targetEnd - movePreviewForTrack.targetStart) * totalW)
        : 0;
      const previewTimeLabel = movePreviewForTrack
        ? getTimelineTimeLabel(movePreviewForTrack.targetStart, durationSeconds)
        : null;
      const showInsertionCue =
        isLayerReorderDrag &&
        draggingTrackIndex != null &&
        dropTrackIndex != null &&
        draggingTrackIndex !== dropTrackIndex &&
        isDropTarget;
      const showDropZone =
        isDropTarget &&
        isLayerReorderDrag &&
        draggingTrackIndex !== originalIndex;
      return {
        track,
        originalIndex,
        isDropTarget,
        isDraggingRow,
        isLayerReorderDrag,
        isBlockMoveDrag,
        isRecentlyAdded,
        isDeleting,
        movePreviewForTrack,
        previewLeft,
        previewWidth,
        previewTimeLabel,
        showInsertionCue,
        showDropZone,
      };
    }),
    [layerTracks, dropTrackIndex, draggingTrackIndex, dragGhost,
     draggingClipMode, draggingClipId, clipMovePreview, recentlyAddedTrackId,
     deletingTrackId, durationSeconds, totalW],
  );

  const layerLabelRows = React.useMemo(
    () => layerRowDescriptors.map((descriptor) => (
      <div
        key={descriptor.track.id}
        className="relative border-b transition-[background,transform,opacity,box-shadow]"
        style={{
          borderColor: "var(--editor-border)",
          opacity: descriptor.isDeleting
            ? 0
            : (descriptor.isLayerReorderDrag &&
                draggingTrackIndex != null &&
                !descriptor.isDraggingRow)
              ? 0.94
              : 1,
          animation: descriptor.isDeleting
            ? "timeline-layer-removing 140ms ease forwards"
            : descriptor.isRecentlyAdded
              ? "timeline-layer-added 220ms ease"
              : undefined,
          pointerEvents: descriptor.isDeleting ? "none" : undefined,
          overflow: descriptor.isDeleting ? "hidden" : undefined,
        }}
      >
        {descriptor.showInsertionCue ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[12] h-0.5"
            style={{ background: "var(--editor-accent)", boxShadow: "0 0 10px rgba(103,232,249,0.45)" }}
          />
        ) : null}
        <TimelineLayerLabel
          track={descriptor.track}
          originalIndex={descriptor.originalIndex}
          labelW={LABEL_W}
          isDraggingRow={descriptor.isDraggingRow}
          isLayerReorderDrag={descriptor.isLayerReorderDrag}
          isDropTarget={descriptor.isDropTarget}
          showInsertionCue={descriptor.showInsertionCue}
          movePreviewForTrack={descriptor.movePreviewForTrack}
          previewTimeLabel={descriptor.previewTimeLabel}
          draggedClipLabel={draggedClip?.label}
          beginTrackReorder={beginTrackReorder}
          onDeleteLayer={(idx) => handleDeleteLayerWithAnimation(descriptor.track.id, idx)}
        />
      </div>
    )),
    [beginTrackReorder, draggedClip?.label, handleDeleteLayerWithAnimation, layerRowDescriptors],
  );

  // Layer rows memoized — playhead scrubbing must not re-render clip DOM
  const layerRows = React.useMemo(
    () => layerRowDescriptors.map((descriptor) => {
      const {
        track,
        originalIndex,
        isDropTarget,
        isDraggingRow,
        isLayerReorderDrag,
        isBlockMoveDrag,
        isRecentlyAdded,
        isDeleting,
        movePreviewForTrack,
        previewLeft,
        previewWidth,
        previewTimeLabel,
        showInsertionCue,
        showDropZone,
      } = descriptor;

      return (
        <div
          key={track.id}
          ref={(node) => { rowRefs.current[`layer-${originalIndex}`] = node; }}
          className="relative border-b transition-[background,transform,opacity,box-shadow]"
          style={{
            borderColor: "var(--editor-border)",
            background:
              isLayerReorderDrag
                ? showDropZone
                  ? "rgba(103,232,249,0.09)"
                  : isDropTarget
                    ? "rgba(103,232,249,0.05)"
                    : "transparent"
                : "transparent",
            opacity: isDeleting ? 0 : (isLayerReorderDrag && draggingTrackIndex != null && !isDraggingRow) ? 0.94 : 1,
            transform: isLayerReorderDrag && isDraggingRow ? "translateX(4px)" : undefined,
            boxShadow: isLayerReorderDrag && isDraggingRow
              ? "inset 0 0 0 1px rgba(103,232,249,0.35), 0 10px 24px rgba(0,0,0,0.18)"
              : showDropZone
                ? "inset 0 0 0 1px rgba(103,232,249,0.24)"
                : undefined,
            animation: isDeleting
              ? "timeline-layer-removing 140ms ease forwards"
              : isRecentlyAdded
                ? "timeline-layer-added 220ms ease"
                : undefined,
            pointerEvents: isDeleting ? "none" : undefined,
            overflow: isDeleting ? "hidden" : undefined,
          }}
        >
          {showDropZone ? (
            <div
              className="pointer-events-none absolute inset-x-2 inset-y-1 z-[10] rounded-lg border border-dashed"
              style={{
                borderColor: "rgba(103,232,249,0.5)",
                background: "linear-gradient(90deg, rgba(103,232,249,0.12) 0%, rgba(103,232,249,0.04) 100%)",
                boxShadow: "inset 0 0 0 1px rgba(103,232,249,0.12), 0 0 18px rgba(103,232,249,0.08)",
              }}
            >
              <div
                className="absolute inset-y-2 left-0 w-1 rounded-full"
                style={{ background: "var(--editor-accent)", boxShadow: "0 0 12px rgba(103,232,249,0.45)" }}
              />
            </div>
          ) : null}
          {showInsertionCue ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-[12] h-0.5"
              style={{ background: "var(--editor-accent)", boxShadow: "0 0 10px rgba(103,232,249,0.45)" }}
            />
          ) : null}
          {movePreviewForTrack ? (
            <div className="pointer-events-none absolute inset-0 z-[11] p-2">
              <div
                className="absolute top-2 h-10 overflow-hidden rounded-md border border-dashed"
                style={{
                  left: previewLeft,
                  width: previewWidth,
                  borderColor: "rgba(103,232,249,0.58)",
                  background: "rgba(103,232,249,0.08)",
                  boxShadow: "inset 0 0 0 1px rgba(103,232,249,0.18), 0 0 18px rgba(103,232,249,0.12)",
                }}
              >
                <div
                  className="absolute inset-y-1 left-0 w-px"
                  style={{ background: "rgba(103,232,249,0.72)", boxShadow: "0 0 10px rgba(103,232,249,0.3)" }}
                />
                <div
                  className="absolute inset-y-1 right-0 w-px"
                  style={{ background: "rgba(103,232,249,0.72)", boxShadow: "0 0 10px rgba(103,232,249,0.3)" }}
                />
                <div className="flex h-full items-center justify-between gap-2 px-2">
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-[var(--editor-accent)]">
                      {draggedClip?.label ?? movePreviewForTrack.draggedClipId}
                    </span>
                    <span className="block truncate text-[10px] uppercase tracking-[0.1em]" style={{ color: "rgba(103,232,249,0.78)" }}>
                      {movePreviewForTrack.isCrossLayerMove ? `Move to ${track.label}` : `Drop at ${previewTimeLabel}`}
                    </span>
                  </div>
                  {movePreviewForTrack.isSnapped ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]"
                      style={{ background: "rgba(103,232,249,0.14)", color: "var(--editor-accent)" }}
                    >
                      Snapped
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          <TimelineTrackRow
                track={track}
                totalW={totalW}
                tint="rgba(255,255,255,0.06)"
                layerTrackIndex={originalIndex}
                selection={selection}
                selectedClipIds={selectedClipIds}
                draggingClipId={draggingClipId}
                draggingClipMode={draggingClipMode}
                clipTimingPreview={clipTimingPreview}
                frameStripCache={frameStripCache}
                canGroupSelection={canGroupSelection}
                layerTracks={layerTracks}
                onPlayheadChange={onPlayheadChange}
                onGroupSelection={onGroupSelection}
                onUngroupSelection={onUngroupSelection}
                onMoveClipToNewLayer={onMoveClipToNewLayer}
                onMoveClipToLayer={onMoveClipToLayer}
                onDuplicateClip={onDuplicateClip}
                onDeleteClip={onDeleteClip}
                onSetClipEnterAnimationType={onSetClipEnterAnimationType}
                onSetClipExitAnimationType={onSetClipExitAnimationType}
                onSetSceneEnterTransitionPreset={onSetSceneEnterTransitionPreset}
                onSetSceneExitTransitionPreset={onSetSceneExitTransitionPreset}
                shouldSuppressClick={shouldSuppressClick}
                beginClipDrag={beginClipDrag}
              />
        </div>
      );
    }),
    // playhead intentionally excluded: clip bars don't render the scrub position
    [layerRowDescriptors, selection, selectedClipIds, canGroupSelection,
     clipTimingPreview, totalW, durationSeconds, draggedClip, frameStripCache,
     onPlayheadChange, onGroupSelection, onUngroupSelection, onMoveClipToNewLayer,
     onMoveClipToLayer, onDuplicateClip, onDeleteClip,
     onSetClipEnterAnimationType, onSetClipExitAnimationType,
     shouldSuppressClick, beginClipDrag],
  );

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--editor-panel)" }}>
      <style>{`
        .timeline-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent}
        .timeline-scroll::-webkit-scrollbar{width:6px;height:6px}
        .timeline-scroll::-webkit-scrollbar-track{background:transparent}
        .timeline-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
        .motionroll-clip:focus-visible{outline:none;box-shadow:0 0 0 1px rgba(103,232,249,.55),0 0 0 3px rgba(103,232,249,.12)}
        @keyframes timeline-layer-added{0%{opacity:0;transform:translateY(8px)}55%{opacity:1;transform:translateY(-1px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes timeline-layer-removing{0%{opacity:1;max-height:56px}100%{opacity:0;max-height:0}}
      `}</style>

      <PlaybackStrip
        playback={playback}
        duration={durationSeconds}
        isPlaying={isPlaying}
        canUndo={canUndo}
        canRedo={canRedo}
        canGroupSelection={canGroupSelection}
        canUngroupSelection={canUngroupSelection}
        onFrameChange={onPlayheadChange}
        onTogglePlay={onPlayToggle}
        onUndo={onUndo}
        onRedo={onRedo}
        onAddLayer={onAddLayer}
        onGroupSelection={onGroupSelection}
        onUngroupSelection={onUngroupSelection}
      />

      <TimelineScrollArea ref={scrollRef} minWidth={totalTrackW + LABEL_W}>
        <>
          <div className="flex min-h-full">
            <div
              className="sticky left-0 z-[60] flex min-h-full w-[168px] shrink-0 flex-col self-stretch"
              style={{
                background: "var(--editor-panel)",
                borderRight: "1px solid var(--editor-border)",
              }}
            >
              <div
                className="flex h-8 items-center border-b px-3"
                style={{
                  background: "var(--editor-panel-elevated)",
                  borderColor: "var(--editor-border)",
                  marginBottom: 1
                }}
              >
                <span
                  className="truncate text-[10px] font-medium uppercase tracking-[0.12em]"
                  style={{ color: "var(--editor-text-dim)" }}
                >
                  Layers
                </span>
              </div>
              <div
                className="flex h-14 items-center border-b px-4"
                style={{ borderColor: "var(--editor-border)" }}
              >
                <span
                  className="truncate text-xs font-medium tracking-[0.03em]"
                  style={{ color: "var(--editor-text)" }}
                >
                  Scene clip
                </span>
              </div>
              {layerLabelRows}
              <div className="min-h-0 flex-1" />
            </div>

            <div className="relative min-w-0 flex-1" style={{ width: totalTrackW }}>
              <TimelineRuler
                totalW={totalW}
                durationSeconds={durationSeconds}
                labelW={LABEL_W}
                playback={playback}
                onPlayheadPointerDown={handlePlayheadPointerDown}
                trackAreaRef={trackAreaRef}
                hideLabelColumn
              />

              <div className="border-b" style={{ borderColor: "var(--editor-border)" }}>
                <TimelineTrackRow
              track={sceneTrack}
              totalW={totalW}
              showFrameStrip
              draggable={false}
              selection={selection}
              selectedClipIds={selectedClipIds}
              draggingClipId={draggingClipId}
              draggingClipMode={draggingClipMode}
              clipTimingPreview={clipTimingPreview}
              frameStripCache={frameStripCache}
              canGroupSelection={canGroupSelection}
              layerTracks={layerTracks}
              onPlayheadChange={onPlayheadChange}
              onGroupSelection={onGroupSelection}
              onUngroupSelection={onUngroupSelection}
              onMoveClipToNewLayer={onMoveClipToNewLayer}
              onMoveClipToLayer={onMoveClipToLayer}
              onDuplicateClip={onDuplicateClip}
              onDeleteClip={onDeleteClip}
              onSetClipEnterAnimationType={onSetClipEnterAnimationType}
              onSetClipExitAnimationType={onSetClipExitAnimationType}
              onSetSceneEnterTransitionPreset={onSetSceneEnterTransitionPreset}
              onSetSceneExitTransitionPreset={onSetSceneExitTransitionPreset}
              shouldSuppressClick={shouldSuppressClick}
              beginClipDrag={beginClipDrag}
                />
              </div>

              {layerRows}

              <div
                className="pointer-events-none absolute inset-0 z-[48] overflow-hidden"
              >
                <TimelinePlayhead playback={playback} totalW={totalW} />
              </div>
            </div>
          </div>
        </>

        {dragGhost ? (
          <div
            className="pointer-events-none absolute z-[28] overflow-hidden rounded-md border"
            style={{
              top: dragGhost.top,
              left: dragGhost.left,
              width: dragGhost.width,
              height: dragGhost.height,
              borderColor: "rgba(103,232,249,0.45)",
              background: "rgba(11,14,20,0.88)",
              boxShadow: "0 16px 34px rgba(0,0,0,0.3), 0 0 0 1px rgba(103,232,249,0.24)",
            }}
          >
            <div className="grid h-full grid-cols-[168px_minmax(0,1fr)]">
              <div
                className="flex items-center gap-2 border-r px-3"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(103,232,249,0.1)" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(103,232,249,0.12)] text-[var(--editor-accent)]">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-[var(--editor-accent)]">{dragGhost.label}</span>
                  <span className="block text-[10px] uppercase tracking-[0.12em] text-[var(--editor-accent)]">Dragging layer</span>
                </div>
              </div>
              <div className="flex items-center px-4">
                <div className="h-10 w-full rounded-md border border-dashed border-[rgba(103,232,249,0.35)] bg-[rgba(255,255,255,0.03)]" />
              </div>
            </div>
          </div>
        ) : null}

        {clipGhost ? (
          <div
            className="pointer-events-none absolute z-[30] overflow-hidden rounded-md border"
            style={{
              top: clipGhost.top,
              left: clipGhost.left,
              width: clipGhost.width,
              height: 40,
              borderColor: "rgba(103,232,249,0.45)",
              background: "rgba(11,14,20,0.9)",
              boxShadow: "0 16px 34px rgba(0,0,0,0.3), 0 0 0 1px rgba(103,232,249,0.24)",
            }}
          >
            <div className="flex h-full items-center justify-between gap-2 px-2">
              <div className="min-w-0">
                <span className="block truncate text-xs font-medium text-white">{clipGhost.label}</span>
                {clipGhost.contentType ? (
                  <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.56)" }}>
                    {clipGhost.contentType}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div
          className="pointer-events-auto absolute bottom-0 left-0 z-[70]"
          style={{
            width: LABEL_W,
            background: "var(--editor-panel)"
          }}
        />
      </TimelineScrollArea>
    </div>
  );
}
