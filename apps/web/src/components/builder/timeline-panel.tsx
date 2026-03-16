"use client";

import React, { Fragment, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  GripVertical,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";
import { clampProgress } from "@motionroll/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TimelineClipModel, TimelineSelection, TimelineTrackModel, TimelineTrackType } from "./timeline-model";

type TimelinePanelProps = {
  tracks: TimelineTrackModel[];
  selection: TimelineSelection;
  playhead: number;
  durationSeconds: number;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onPlayheadChange: (value: number) => void;
  onSelectionChange: (selection: TimelineSelection) => void;
  onClipTimingChange: (clipId: string, timing: { start: number; end: number }) => void;
  onMoveClipToLayer: (clipId: string, targetLayer: number) => void;
  onAddLayer: () => void;
  onDeleteLayer: (layerRowIndex: number) => void;
  onAddAtPlayhead: () => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onReorderTracks: (fromIndex: number, toIndex: number) => void;
  onSetClipTransitionPreset: (clipId: string, preset?: string) => void;
};

type ClipDragState =
  | {
      type: "move" | "resize-start" | "resize-end";
      clipId: string;
      trackType: TimelineTrackType;
      startX: number;
      startY: number;
      startScrollLeft: number;
      initialStart: number;
      initialEnd: number;
      layerTrackIndex?: number;
    }
  | null;

type TrackReorderState =
  | {
      fromIndex: number;
      pointerOffsetY: number;
      startX: number;
      startY: number;
    }
  | null;

type DragGhostState =
  | {
      kind: "layer";
      label: string;
      top: number;
      left: number;
      width: number;
      height: number;
    }
  | null;

type ClipGhostState =
  | {
      label: string;
      top: number;
      left: number;
      width: number;
      contentType?: string;
      transitionLabel?: string | null;
    }
  | null;

type ClipDragMode = "move" | "resize-start" | "resize-end" | null;

const LABEL_W = 168;
const PX_PER_SEC = 118;
const MIN_CLIP_PROGRESS = 0.04;
const EDGE_SCROLL_THRESHOLD = 88;
const EDGE_SCROLL_MAX_STEP = 18;

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

function PlaybackStrip({
  playhead, duration, isPlaying, onFrameChange, onTogglePlay,
}: {
  playhead: number; duration: number; isPlaying: boolean;
  onFrameChange: (p: number) => void; onTogglePlay: () => void;
}) {
  const currentSec = playhead * duration;
  const ib = "flex h-8 w-8 items-center justify-center rounded-md text-[var(--editor-text-dim)] transition-colors hover:bg-[var(--editor-hover)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]";
  return (
    <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}>
      <div className="flex min-w-0 items-center gap-2 text-xs tabular-nums" style={{ color: "var(--editor-text-dim)" }}>
        <span className="font-medium" style={{ color: "var(--editor-text)" }}>{formatTime(currentSec)}</span>
        <span>/ {formatTime(duration)}</span>
        <span className="ml-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(103,232,249,0.08)", color: "var(--editor-accent)" }}>
          frame {formatFrame(playhead, duration)}
        </span>
      </div>
      <div className="flex items-center gap-1 justify-self-center">
        <button type="button" onClick={() => onFrameChange(0)} className={ib}><SkipBack className="h-4 w-4" /></button>
        <button type="button" onClick={() => onFrameChange(Math.max(0, playhead - 1 / Math.max(duration * 24, 1)))} className={ib}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" onClick={onTogglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--editor-selected)] text-[var(--editor-accent)] transition-colors hover:bg-[rgba(103,232,249,0.18)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <button type="button" onClick={() => onFrameChange(Math.min(1, playhead + 1 / Math.max(duration * 24, 1)))} className={ib}><ChevronRight className="h-4 w-4" /></button>
        <button type="button" onClick={() => onFrameChange(1)} className={ib}><SkipForward className="h-4 w-4" /></button>
      </div>
      <div />
    </div>
  );
}

export function TimelinePanel({
  tracks, selection, playhead, durationSeconds, isPlaying,
  onPlayToggle, onPlayheadChange, onSelectionChange,
  onClipTimingChange, onMoveClipToLayer, onAddLayer, onDeleteLayer, onAddAtPlayhead, onDuplicateClip, onDeleteClip,
  onReorderTracks, onSetClipTransitionPreset,
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
  const [dropTrackIndex, setDropTrackIndex] = useState<number | null>(null);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [draggingClipMode, setDraggingClipMode] = useState<ClipDragMode>(null);
  const [draggingTrackIndex, setDraggingTrackIndex] = useState<number | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhostState>(null);
  const [clipGhost, setClipGhost] = useState<ClipGhostState>(null);
  const totalW = Math.max(960, Math.round(durationSeconds * PX_PER_SEC));
  const playheadX = LABEL_W + playhead * totalW;
  const rulerTicks = Math.max(6, Math.ceil(durationSeconds));
  const sceneTrack = tracks.find((t) => t.type === "section");
  const layerTracks = tracks.filter((t) => t.type === "layer");

  function suppressPostDragClick() {
    suppressClickUntilRef.current = performance.now() + 220;
  }

  function shouldSuppressClick() {
    return performance.now() < suppressClickUntilRef.current;
  }

  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const scroll = scrollRef.current;
    const headX = LABEL_W + playhead * totalW;
    const visibleLeft = scroll.scrollLeft;
    const visibleRight = scroll.scrollLeft + scroll.clientWidth;
    const margin = scroll.clientWidth * 0.25;
    if (headX > visibleRight - margin) {
      scroll.scrollLeft = headX - scroll.clientWidth * 0.6;
    } else if (headX < visibleLeft + LABEL_W + 8) {
      scroll.scrollLeft = Math.max(0, headX - LABEL_W - 24);
    }
  }, [playhead, isPlaying, totalW]);

  const snapPoints = React.useMemo(() => {
    const pts = new Set<number>([0, 1]);
    for (let i = 0; i <= rulerTicks; i++) pts.add(clampProgress(i / Math.max(durationSeconds, 1)));
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === draggingClipId) {
          continue;
        }
        pts.add(clip.start);
        pts.add(clip.end);
      }
    }
    return [...pts].sort((a, b) => a - b);
  }, [draggingClipId, durationSeconds, rulerTicks, tracks]);

  function snap(value: number, threshold = 0.01) {
    let next = clampProgress(value);
    let best = threshold;
    for (const pt of snapPoints) {
      const d = Math.abs(pt - next);
      if (d <= best) { best = d; next = pt; }
    }
    return clampProgress(next);
  }

  function detectDropTrackIndex(clientY: number) {
    for (const [key, node] of Object.entries(rowRefs.current)) {
      if (!node || !key.startsWith("layer-")) continue;
      const rect = node.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return Number(key.replace("layer-", ""));
    }
    return null;
  }

  function getEdgeScrollStep(distanceToEdge: number) {
    const strength = clampProgress((EDGE_SCROLL_THRESHOLD - distanceToEdge) / EDGE_SCROLL_THRESHOLD);
    return strength * EDGE_SCROLL_MAX_STEP;
  }

  function getAutoScrollVelocity() {
    const scrollNode = scrollRef.current;
    const pointer = pointerClientRef.current;
    if (!scrollNode || !pointer) {
      return { vx: 0, vy: 0 };
    }
    const rect = scrollNode.getBoundingClientRect();
    let vx = 0;
    let vy = 0;

    if (pointer.x >= rect.right - EDGE_SCROLL_THRESHOLD) {
      vx = getEdgeScrollStep(rect.right - pointer.x);
    } else if (pointer.x <= rect.left + EDGE_SCROLL_THRESHOLD) {
      vx = -getEdgeScrollStep(pointer.x - rect.left);
    }

    if (pointer.y >= rect.bottom - EDGE_SCROLL_THRESHOLD) {
      vy = getEdgeScrollStep(rect.bottom - pointer.y);
    } else if (pointer.y <= rect.top + EDGE_SCROLL_THRESHOLD) {
      vy = -getEdgeScrollStep(pointer.y - rect.top);
    }

    return { vx, vy };
  }

  function stopAutoScroll() {
    if (autoScrollRafRef.current != null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }

  function startAutoScroll() {
    if (autoScrollRafRef.current != null) {
      return;
    }

    const tick = () => {
      const scrollNode = scrollRef.current;
      const driver = autoScrollDriverRef.current;
      if (!scrollNode || !driver || !pointerClientRef.current) {
        autoScrollRafRef.current = null;
        return;
      }

      const { vx, vy } = getAutoScrollVelocity();
      if (vx !== 0 || vy !== 0) {
        if (vx !== 0) {
          scrollNode.scrollLeft = Math.max(0, scrollNode.scrollLeft + vx);
        }
        if (vy !== 0) {
          scrollNode.scrollTop = Math.max(0, scrollNode.scrollTop + vy);
        }
        driver();
      }

      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    autoScrollRafRef.current = requestAnimationFrame(tick);
  }

  function resetDragVisualState() {
    dropTrackIndexRef.current = null;
    pointerClientRef.current = null;
    autoScrollDriverRef.current = null;
    stopAutoScroll();
    setDropTrackIndex(null);
    setDraggingClipId(null);
    setDraggingClipMode(null);
    setDraggingTrackIndex(null);
    setDragGhost(null);
    setClipGhost(null);
  }

  function updatePlayheadFromPointer(clientX: number) {
    const trackArea = trackAreaRef.current;
    if (!trackArea) return;
    const rect = trackArea.getBoundingClientRect();
    onPlayheadChange(clampProgress((clientX - rect.left) / Math.max(rect.width, 1)));
  }

  function handlePlayheadPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const trackAreaNode = trackAreaRef.current;
    if (!trackAreaNode) return;
    const trackArea: HTMLDivElement = trackAreaNode;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    pointerClientRef.current = { x: e.clientX, y: e.clientY };
    autoScrollDriverRef.current = () => {
      const pointer = pointerClientRef.current;
      if (!pointer) return;
      updatePlayheadFromPointer(pointer.x);
    };
    updatePlayheadFromPointer(e.clientX);
    startAutoScroll();

    function onMove(ev: PointerEvent) {
      pointerClientRef.current = { x: ev.clientX, y: ev.clientY };
      updatePlayheadFromPointer(ev.clientX);
    }
    function onUp() {
      resetDragVisualState();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function seekFromPointer(clientX: number) {
    if (clipDragStateRef.current || trackReorderStateRef.current) return;
    updatePlayheadFromPointer(clientX);
  }

  function updateClipDragFromPointer(clientX: number, clientY: number) {
    const state = clipDragStateRef.current;
    const trackArea = trackAreaRef.current;
    if (!state || !trackArea) return;

    const rect = trackArea.getBoundingClientRect();
    const scrollDelta = (scrollRef.current?.scrollLeft ?? 0) - state.startScrollLeft;
    const delta = (clientX - state.startX + scrollDelta) / Math.max(rect.width, 1);
    let nextStart = state.initialStart;
    let nextEnd = state.initialEnd;
    if (state.type === "move") {
      const dur = state.initialEnd - state.initialStart;
      nextStart = snap(state.initialStart + delta);
      nextEnd = nextStart + dur;
      if (nextEnd > 1) { nextEnd = 1; nextStart = Math.max(0, nextEnd - dur); }
      const candidate = detectDropTrackIndex(clientY);
      dropTrackIndexRef.current = candidate ?? null;
      setDropTrackIndex(candidate ?? null);
    } else if (state.type === "resize-start") {
      nextStart = snap(Math.min(state.initialEnd - MIN_CLIP_PROGRESS, state.initialStart + delta));
    } else {
      nextEnd = snap(Math.max(state.initialStart + MIN_CLIP_PROGRESS, state.initialEnd + delta));
    }

    setClipGhost((current) =>
      current
        ? {
            ...current,
            left: rect.left + nextStart * rect.width,
            top: clientY - 20,
            width: Math.max(14, (nextEnd - nextStart) * rect.width),
          }
        : current,
    );

    onClipTimingChange(state.clipId, { start: clampProgress(nextStart), end: clampProgress(nextEnd) });
  }

  function updateTrackGhostPosition(clientY: number) {
    setDragGhost((current) =>
      current && trackReorderStateRef.current
        ? { ...current, top: clientY - trackReorderStateRef.current.pointerOffsetY }
        : current
    );
  }

  function updateTrackReorderFromPointer(clientY: number) {
    const state = trackReorderStateRef.current;
    if (!state) return;
    const candidate = detectDropTrackIndex(clientY);
    dropTrackIndexRef.current = candidate ?? state.fromIndex;
    setDropTrackIndex(candidate ?? state.fromIndex);
    updateTrackGhostPosition(clientY);
  }

  function beginClipDrag(e: React.MouseEvent, type: Exclude<ClipDragState, null>["type"], clip: TimelineClipModel, layerTrackIndex?: number) {
    e.preventDefault();
    e.stopPropagation();
    onSelectionChange({ clipId: clip.id, trackType: clip.trackType });

    const rowNode =
      typeof layerTrackIndex === "number" ? rowRefs.current[`layer-${layerTrackIndex}`] : null;
    const trackAreaRect = trackAreaRef.current?.getBoundingClientRect();
    const rowRect = rowNode?.getBoundingClientRect();
    const ghostTop = rowRect ? rowRect.top + 8 : e.clientY - 20;
    const ghostLeft = trackAreaRect ? trackAreaRect.left + clip.start * trackAreaRect.width : e.clientX;
    const ghostWidth = trackAreaRect
      ? Math.max(14, (clip.end - clip.start) * trackAreaRect.width)
      : 140;
    const transitionLabel = clip.metadata?.transitionPreset?.replace(/-/g, " ") ?? null;

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
    setDraggingClipId(clip.id);
    setDraggingClipMode(type);
    setClipGhost({
      label: clip.label ?? clip.id,
      top: ghostTop,
      left: ghostLeft,
      width: ghostWidth,
      contentType: clip.metadata?.contentType,
      transitionLabel,
    });
    if (typeof layerTrackIndex === "number" && type === "move") {
      setDropTrackIndex(layerTrackIndex);
      dropTrackIndexRef.current = layerTrackIndex;
    }
    pointerClientRef.current = { x: e.clientX, y: e.clientY };
    autoScrollDriverRef.current = () => {
      const pointer = pointerClientRef.current;
      if (!pointer) return;
      updateClipDragFromPointer(pointer.x, pointer.y);
    };
    startAutoScroll();

    const handleMove = (me: MouseEvent) => {
      pointerClientRef.current = { x: me.clientX, y: me.clientY };
      updateClipDragFromPointer(me.clientX, me.clientY);
    };

    const handleUp = () => {
      const state = clipDragStateRef.current;
      const pointer = pointerClientRef.current;
      const didDrag =
        !!state &&
        !!pointer &&
        (Math.abs(pointer.x - state.startX) > 4 || Math.abs(pointer.y - state.startY) > 4);
      if (
        state?.type === "move" &&
        dropTrackIndexRef.current != null
      ) {
        const targetTrack = layerTracks[dropTrackIndexRef.current];
        const targetLayer = targetTrack?.metadata?.layerIndex;
        const sourceTrack =
          typeof state.layerTrackIndex === "number" ? layerTracks[state.layerTrackIndex] : undefined;
        const sourceLayer = sourceTrack?.metadata?.layerIndex;
        if (typeof targetLayer === "number" && targetLayer !== sourceLayer) {
          onMoveClipToLayer(state.clipId, targetLayer);
        }
      }
      if (didDrag) {
        suppressPostDragClick();
      }
      clipDragStateRef.current = null;
      resetDragVisualState();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  function beginTrackReorder(e: React.MouseEvent, fromIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    const rowNode = rowRefs.current[`layer-${fromIndex}`];
    const rowRect = rowNode?.getBoundingClientRect();
    trackReorderStateRef.current = {
      fromIndex,
      pointerOffsetY: rowRect ? e.clientY - rowRect.top : 20,
      startX: e.clientX,
      startY: e.clientY,
    };
    setDraggingTrackIndex(fromIndex);
    setDropTrackIndex(fromIndex);
    dropTrackIndexRef.current = fromIndex;
    pointerClientRef.current = { x: e.clientX, y: e.clientY };
    if (rowRect) {
      setDragGhost({
        kind: "layer",
        label: layerTracks[fromIndex]?.label ?? `Layer ${fromIndex + 1}`,
        left: rowRect.left,
        top: rowRect.top,
        width: rowRect.width,
        height: rowRect.height,
      });
    }
    autoScrollDriverRef.current = () => {
      const pointer = pointerClientRef.current;
      if (!pointer) return;
      updateTrackReorderFromPointer(pointer.y);
    };
    startAutoScroll();

    const handleMove = (me: MouseEvent) => {
      pointerClientRef.current = { x: me.clientX, y: me.clientY };
      updateTrackReorderFromPointer(me.clientY);
    };

    const handleUp = () => {
      const state = trackReorderStateRef.current;
      const pointer = pointerClientRef.current;
      const didDrag =
        !!state &&
        !!pointer &&
        (Math.abs(pointer.x - state.startX) > 4 || Math.abs(pointer.y - state.startY) > 4);
      if (
        state &&
        dropTrackIndexRef.current != null &&
        dropTrackIndexRef.current !== state.fromIndex
      ) {
        onReorderTracks(state.fromIndex, dropTrackIndexRef.current);
      }
      if (didDrag) {
        suppressPostDragClick();
      }
      trackReorderStateRef.current = null;
      resetDragVisualState();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  function renderFrameStrip(frameStrip: string[] | undefined, clip: TimelineClipModel) {
    if (!frameStrip?.length) return null;
    return (
      <div className="absolute inset-0 flex overflow-hidden rounded-md">
        {frameStrip.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            className="relative h-full flex-1 overflow-hidden border-r last:border-r-0 transition-opacity hover:opacity-100"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
            onClick={(ev) => {
              if (shouldSuppressClick()) {
                ev.preventDefault();
                ev.stopPropagation();
                return;
              }
              ev.stopPropagation();
              const local = frameStrip.length <= 1 ? 0 : i / (frameStrip.length - 1);
              onPlayheadChange(clampProgress(clip.start + local * (clip.end - clip.start)));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover opacity-90" draggable={false} />
          </button>
        ))}
      </div>
    );
  }

  function renderTrack(track: TimelineTrackModel | undefined, opts?: { tint?: string; frameStrip?: boolean; layerTrackIndex?: number; draggable?: boolean }) {
    if (!track) return <div className="relative h-14" style={{ width: totalW }} />;
    return (
      <div className="relative h-14" style={{ width: totalW }}>
        {track.clips.map((clip) => {
          const left = clip.start * totalW;
          const width = Math.max(14, (clip.end - clip.start) * totalW);
          const isSelected = selection?.clipId === clip.id;
          const frameStrip = opts?.frameStrip ? clip.metadata?.frameStrip : undefined;
          const transitionLabel = clip.metadata?.transitionPreset?.replace(/-/g, " ") ?? null;
          const isDragging = draggingClipId === clip.id;
          const clipStackIndex = track.clips.findIndex((entry) => entry.id === clip.id);
          const stackZIndex = track.type === "section" ? 2 : isDragging ? 40 : isSelected ? 30 : 10 + clipStackIndex;
          const isDraggable = opts?.draggable ?? track.type !== "section";
          return (
            <Fragment key={clip.id}>
              <div
                tabIndex={0}
                className="motionroll-clip group absolute top-2 h-10 select-none rounded-md border transition-[background,border-color,box-shadow,transform,opacity] duration-150 hover:-translate-y-[1px] hover:border-[rgba(255,255,255,0.14)]"
                style={{
                  left,
                  width,
                  zIndex: stackZIndex,
                  background: frameStrip ? "#0c1118" : isSelected ? "rgba(103,232,249,0.18)" : opts?.tint ?? "rgba(255,255,255,0.05)",
                  borderColor: isSelected ? "var(--editor-accent)" : "rgba(255,255,255,0.08)",
                  boxShadow: isDragging
                    ? "0 0 0 1px rgba(103,232,249,0.45), 0 12px 30px rgba(0,0,0,0.28)"
                    : isSelected
                      ? "0 0 0 1px rgba(103,232,249,0.25), 0 8px 24px rgba(0,0,0,0.22)"
                      : "inset 0 1px 0 rgba(255,255,255,0.02)",
                  color: "var(--editor-text)",
                  opacity: isDragging ? 0.24 : 1,
                  transform: isDragging ? "translateY(-1px) scale(1.01)" : undefined,
                }}
                onClick={(ev) => {
                  if (shouldSuppressClick()) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    return;
                  }
                  ev.stopPropagation();
                  onSelectionChange({ clipId: clip.id, trackType: track.type });
                  const rect = ev.currentTarget.getBoundingClientRect();
                  const local = clampProgress((ev.clientX - rect.left) / Math.max(rect.width, 1));
                  onPlayheadChange(clampProgress(clip.start + local * (clip.end - clip.start)));
                }}
                onMouseDown={isDraggable ? (ev) => beginClipDrag(ev, "move", clip, opts?.layerTrackIndex) : undefined}
              >
                {frameStrip ? renderFrameStrip(frameStrip, clip) : null}
                <div className="relative z-[1] flex h-full items-center justify-between gap-2 px-2">
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-white">{clip.label ?? clip.id}</span>
                    {transitionLabel ? (
                      <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(103,232,249,0.78)" }}>{transitionLabel}</span>
                    ) : !frameStrip && clip.metadata?.contentType ? (
                      <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.56)" }}>{clip.metadata.contentType}</span>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(10,10,12,0.45)] text-[var(--editor-text-dim)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[rgba(255,255,255,0.08)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
                        style={{ opacity: isSelected ? 1 : undefined }}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <Ellipsis className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Overlay transition</DropdownMenuLabel>
                      {(["fade", "crossfade", "wipe", "zoom-dissolve", "blur-dissolve"] as const).map((p) => (
                        <DropdownMenuItem key={p} onClick={() => onSetClipTransitionPreset(clip.id, p)}>
                          {p.replace(/-/g, " ")}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onSetClipTransitionPreset(clip.id, undefined)}>Clear transition</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onDuplicateClip(clip.id)}>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDeleteClip(clip.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div
                  className="timeline-resize-handle absolute inset-y-0 left-0 z-[2] w-2 rounded-l-md cursor-ew-resize"
                  style={{ background: "rgba(191,227,255,0.55)", opacity: isSelected ? 0.95 : 0 }}
                  onMouseDown={(ev) => beginClipDrag(ev, "resize-start", clip, opts?.layerTrackIndex)}
                />
                <div
                  className="timeline-resize-handle absolute inset-y-0 right-0 z-[2] w-2 rounded-r-md cursor-ew-resize"
                  style={{ background: "rgba(191,227,255,0.55)", opacity: isSelected ? 0.95 : 0 }}
                  onMouseDown={(ev) => beginClipDrag(ev, "resize-end", clip, opts?.layerTrackIndex)}
                />
              </div>
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--editor-panel)" }}>
      <style>{`
        .timeline-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent}
        .timeline-scroll::-webkit-scrollbar{width:6px;height:6px}
        .timeline-scroll::-webkit-scrollbar-track{background:transparent}
        .timeline-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
        .motionroll-clip:focus-visible{outline:none;box-shadow:0 0 0 1px rgba(103,232,249,.55),0 0 0 3px rgba(103,232,249,.12)}
      `}</style>

      <PlaybackStrip playhead={playhead} duration={durationSeconds} isPlaying={isPlaying} onFrameChange={onPlayheadChange} onTogglePlay={onPlayToggle} />

      <div
        ref={scrollRef}
        className="timeline-scroll relative min-h-0 flex-1 overflow-auto"
        onClick={(e) => {
          if (shouldSuppressClick()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          const target = e.target as HTMLElement;
          if (!target.closest(".motionroll-clip")) seekFromPointer(e.clientX);
        }}
      >
        <div className="relative" style={{ minWidth: totalW + LABEL_W }}>
          <div
            className="sticky top-0 z-10 flex border-b"
            style={{ background: "var(--editor-panel-elevated)", borderColor: "var(--editor-border)" }}
          >
            <div
              className="sticky left-0 z-20 flex h-8 shrink-0 items-center border-r px-3"
              style={{ width: LABEL_W, borderColor: "var(--editor-border)", background: "var(--editor-panel-elevated)" }}
            >
              <button
                type="button"
                className="flex h-6 items-center gap-1.5 rounded px-1.5 text-[12px] font-medium normal-case tracking-normal transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
                style={{
                  background: "transparent",
                  color: "var(--editor-text-dim)",
                }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onAddLayer();
                }}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <Plus className="h-3 w-3" />
                </span>
                Layer
              </button>
            </div>
            <div
              ref={trackAreaRef}
              className="relative h-8 flex-1 cursor-ew-resize"
              title="Click or drag to scrub"
            >
              {Array.from({ length: rulerTicks + 1 }).map((_, i) => {
                const x = (i / Math.max(durationSeconds, 1)) * totalW;
                return (
                  <div key={i} className="pointer-events-none absolute top-0 flex h-full items-end" style={{ left: x }}>
                    <div className="h-2.5 w-px" style={{ background: "rgba(255,255,255,0.14)" }} />
                    <span className="ml-1 text-[10px]" style={{ color: "var(--editor-text-dim)" }}>{formatTime(i)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex border-b" style={{ borderColor: "var(--editor-border)" }}>
            <div
              className="sticky left-0 z-[8] flex h-14 shrink-0 items-center border-r px-4"
              style={{ width: LABEL_W, background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
            >
              <span className="truncate text-xs font-medium tracking-[0.03em]" style={{ color: "var(--editor-text)" }}>
                Scene range
              </span>
            </div>
            <div className="min-w-0 flex-1">{renderTrack(sceneTrack, { frameStrip: true, draggable: false })}</div>
          </div>

          {layerTracks.map((track, originalIndex) => {
            const isDropTarget = dropTrackIndex === originalIndex;
            const isDraggingRow = draggingTrackIndex === originalIndex;
            const isLayerReorderDrag = dragGhost !== null;
            const isBlockMoveDrag = draggingClipMode === "move" && draggingClipId !== null && !isLayerReorderDrag;
            const draggedClipTrack = isBlockMoveDrag
              ? layerTracks.find((layerTrack) => layerTrack.clips.some((clip) => clip.id === draggingClipId))
              : undefined;
            const showBlockDropZone =
              isBlockMoveDrag &&
              isDropTarget &&
              draggedClipTrack?.metadata?.layerIndex !== track.metadata?.layerIndex;
            const showInsertionCue =
              isLayerReorderDrag &&
              draggingTrackIndex != null &&
              dropTrackIndex != null &&
              draggingTrackIndex !== dropTrackIndex &&
              isDropTarget;
            return (
              <div
                key={track.id}
                ref={(node) => { rowRefs.current[`layer-${originalIndex}`] = node; }}
                className="relative flex border-b transition-[background,transform,opacity,box-shadow]"
                style={{
                  borderColor: "var(--editor-border)",
                  background: isDropTarget ? "rgba(103,232,249,0.05)" : "transparent",
                  opacity: (isLayerReorderDrag && draggingTrackIndex != null && !isDraggingRow) ? 0.94 : 1,
                  transform: isLayerReorderDrag && isDraggingRow ? "translateX(4px)" : undefined,
                  boxShadow: isLayerReorderDrag && isDraggingRow ? "inset 0 0 0 1px rgba(103,232,249,0.35), 0 10px 24px rgba(0,0,0,0.18)" : undefined,
                }}
              >
                {showInsertionCue ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-[12] h-0.5"
                    style={{ background: "var(--editor-accent)", boxShadow: "0 0 10px rgba(103,232,249,0.45)" }}
                  />
                ) : null}
                <div
                  className="sticky left-0 z-[14] flex h-14 shrink-0 items-center gap-2 border-r px-3"
                  style={{
                    width: LABEL_W,
                    background: isLayerReorderDrag && isDraggingRow
                      ? "rgba(103,232,249,0.12)"
                      : isDropTarget
                        ? "rgba(103,232,249,0.08)"
                        : "var(--editor-panel)",
                    borderColor: "var(--editor-border)",
                  }}
                >
                  <button
                    type="button"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
                    title="Drag to reorder layer"
                    aria-label={`Drag to reorder ${track.label}`}
                    onMouseDown={(ev) => beginTrackReorder(ev, originalIndex)}
                    style={{
                      color: isLayerReorderDrag && isDraggingRow ? "var(--editor-accent)" : "var(--editor-text-dim)",
                      background: isLayerReorderDrag && isDraggingRow ? "rgba(103,232,249,0.12)" : undefined,
                      cursor: "ns-resize",
                    }}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--editor-text-dim)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
                    title={`Delete ${track.label}`}
                    aria-label={`Delete ${track.label}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onDeleteLayer(originalIndex);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <span
                      className="block truncate text-xs font-medium tracking-[0.03em]"
                      style={{ color: isLayerReorderDrag && isDraggingRow ? "var(--editor-accent)" : "var(--editor-text)" }}
                    >
                      {track.label}
                    </span>
                    <span
                      className="block text-[10px] uppercase tracking-[0.12em]"
                      style={{ color: (isLayerReorderDrag && isDraggingRow) || isDropTarget ? "var(--editor-accent)" : "var(--editor-text-dim)" }}
                    >
                      {isLayerReorderDrag && isDraggingRow
                        ? "Dragging layer"
                        : showInsertionCue
                          ? "Drop here"
                          : showBlockDropZone
                            ? "Move block here"
                            : `Layer ${originalIndex + 1}`}
                    </span>
                  </div>
                </div>
                <div className="relative min-w-0 flex-1">
                  {showBlockDropZone ? (
                    <div className="pointer-events-none absolute inset-0 z-[11] p-2">
                      <div
                        className="flex h-full items-center justify-center rounded-md border border-dashed text-[10px] font-medium uppercase tracking-[0.14em]"
                        style={{
                          borderColor: "rgba(103,232,249,0.58)",
                          background: "rgba(103,232,249,0.08)",
                          color: "var(--editor-accent)",
                          boxShadow: "inset 0 0 0 1px rgba(103,232,249,0.18), 0 0 18px rgba(103,232,249,0.12)",
                        }}
                      >
                        Drop block into {track.label}
                      </div>
                    </div>
                  ) : null}
                  {renderTrack(track, { tint: "rgba(255,255,255,0.06)", layerTrackIndex: originalIndex })}
                </div>
              </div>
            );
          })}

          <div
            className="pointer-events-auto absolute top-0 bottom-0 z-[12] w-5 -translate-x-1/2 cursor-ew-resize"
            style={{ left: playheadX }}
            onPointerDown={handlePlayheadPointerDown}
            title="Drag to scrub"
          >
            <div
              className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2"
              style={{ background: "var(--editor-playhead)", boxShadow: "0 0 8px rgba(103,232,249,0.45)" }}
            />
            <div
              className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "8px solid var(--editor-playhead)",
              }}
            />
          </div>
        </div>

        {dragGhost ? (
          <div
            className="pointer-events-none fixed z-[28] overflow-hidden rounded-md border"
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
            className="pointer-events-none fixed z-[30] overflow-hidden rounded-md border"
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
                {clipGhost.transitionLabel ? (
                  <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(103,232,249,0.78)" }}>
                    {clipGhost.transitionLabel}
                  </span>
                ) : clipGhost.contentType ? (
                  <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.56)" }}>
                    {clipGhost.contentType}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
