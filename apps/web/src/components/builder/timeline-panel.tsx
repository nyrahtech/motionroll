"use client";

import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { clampProgress } from "@motionroll/shared";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TimelineTrackModel, TimelineSelection, TimelineTrackType } from "./timeline-model";

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
  onAddAtPlayhead: () => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onMoveClipToTrack: (clipId: string, nextTrack: "overlay" | "moment") => void;
  onSetClipTransitionPreset: (clipId: string, preset?: string) => void;
};

type DragState =
  | {
      type: "move" | "resize-start" | "resize-end";
      clipId: string;
      trackType: TimelineTrackType;
      startX: number;
      initialStart: number;
      initialEnd: number;
    }
  | null;

const LABEL_W = 184;
const PX_PER_SEC = 118;
const MIN_CLIP_PROGRESS = 0.04;

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFrame(progress: number, durationSeconds: number) {
  const approxFrames = Math.max(1, Math.round(durationSeconds * 24));
  const frame = Math.min(approxFrames, Math.max(1, Math.round(progress * approxFrames) + 1));
  return `Frame ${frame} / ${approxFrames}`;
}

function PlaybackStrip({
  playhead,
  duration,
  isPlaying,
  onFrameChange,
  onTogglePlay,
}: {
  playhead: number;
  duration: number;
  isPlaying: boolean;
  onFrameChange: (progress: number) => void;
  onTogglePlay: () => void;
}) {
  const currentSec = playhead * duration;
  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-md text-[var(--editor-text-dim)] transition-colors hover:bg-[var(--editor-hover)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] cursor-pointer";

  return (
    <div
      className="grid h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-4"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
    >
      <div className="flex items-center gap-1 justify-self-start">
        <button type="button" onClick={() => onFrameChange(0)} className={iconButton}>
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onFrameChange(Math.max(0, playhead - 1 / Math.max(duration * 24, 1)))}
          className={iconButton}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--editor-selected)] text-[var(--editor-accent)] transition-colors hover:bg-[rgba(103,232,249,0.18)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] cursor-pointer"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onFrameChange(Math.min(1, playhead + 1 / Math.max(duration * 24, 1)))}
          className={iconButton}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onFrameChange(1)} className={iconButton}>
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      <div className="min-w-0 px-2">
        <Slider
          value={[playhead]}
          min={0}
          max={1}
          step={0.001}
          onValueChange={([v]) => onFrameChange(v)}
          className="cursor-pointer"
        />
      </div>

      <div className="flex min-w-[180px] items-center justify-end gap-3 text-xs tabular-nums justify-self-end" style={{ color: "var(--editor-text-dim)" }}>
        <span>{formatTime(currentSec)} / {formatTime(duration)}</span>
        <span>{formatFrame(playhead, duration)}</span>
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  onAdd,
  activeDrop,
  rowRef,
  children,
}: {
  label: string;
  onAdd?: () => void;
  activeDrop?: boolean;
  rowRef?: (node: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div ref={rowRef} className="flex border-b" style={{ borderColor: "var(--editor-border)" }}>
      <div
        className="flex h-14 w-[184px] shrink-0 items-center justify-between border-r px-4"
        style={{
          background: activeDrop ? "rgba(103,232,249,0.07)" : "var(--editor-panel)",
          borderColor: "var(--editor-border)",
        }}
      >
        <span className="text-xs font-medium tracking-[0.03em]" style={{ color: "var(--editor-text)" }}>{label}</span>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--editor-text-dim)] transition-colors hover:bg-[var(--editor-hover)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 transition-colors" style={{ background: activeDrop ? "rgba(103,232,249,0.05)" : "transparent" }}>{children}</div>
    </div>
  );
}

export function TimelinePanel({
  tracks,
  selection,
  playhead,
  durationSeconds,
  isPlaying,
  onPlayToggle,
  onPlayheadChange,
  onSelectionChange,
  onClipTimingChange,
  onAddAtPlayhead,
  onDuplicateClip,
  onDeleteClip,
  onMoveClipToTrack,
  onSetClipTransitionPreset,
}: TimelinePanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackAreaRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState>(null);
  const dropTrackRef = useRef<"overlay" | "moment" | null>(null);
  const [dropTrack, setDropTrack] = useState<"overlay" | "moment" | null>(null);
  const totalW = Math.max(960, Math.round(durationSeconds * PX_PER_SEC));
  const playheadX = LABEL_W + playhead * totalW;
  const rulerTicks = Math.max(6, Math.ceil(durationSeconds));
  const sectionTrack = tracks.find((t) => t.type === "section");
  const contentTrack = tracks.find((t) => t.type === "overlay");
  const momentsTrack = tracks.find((t) => t.type === "moment");

  // Auto-scroll timeline to keep playhead visible during playback
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

  const snapPoints = useMemo(() => {
    const points = new Set<number>([0, 1]);
    for (let i = 0; i <= rulerTicks; i += 1) {
      points.add(clampProgress(i / Math.max(durationSeconds, 1)));
    }
    for (const track of tracks) {
      for (const clip of track.clips) {
        points.add(clip.start);
        points.add(clip.end);
      }
    }
    return [...points].sort((a, b) => a - b);
  }, [durationSeconds, rulerTicks, tracks]);

  function snap(value: number, threshold = 0.01) {
    let next = clampProgress(value);
    let best = threshold;
    for (const point of snapPoints) {
      const distance = Math.abs(point - next);
      if (distance <= best) {
        best = distance;
        next = point;
      }
    }
    return clampProgress(next);
  }

  function seekFromPointer(clientX: number) {
    if (dragStateRef.current) return; // don't seek while dragging a clip
    if (!trackAreaRef.current) return;
    const rect = trackAreaRef.current.getBoundingClientRect();
    const progress = clampProgress((clientX - rect.left) / Math.max(rect.width, 1));
    onPlayheadChange(progress);
  }

  function detectDropTrack(clientY: number) {
    for (const trackType of ["overlay", "moment"] as const) {
      const node = rowRefs.current[trackType];
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return trackType;
      }
    }
    return null;
  }

  function beginDrag(
    event: React.MouseEvent,
    type: Exclude<DragState, null>["type"],
    clipId: string,
    trackType: TimelineTrackType,
    start: number,
    end: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = { type, clipId, trackType, startX: event.clientX, initialStart: start, initialEnd: end };

    const handleMove = (moveEvent: MouseEvent) => {
      const state = dragStateRef.current;
      if (!state || !trackAreaRef.current) return;
      const rect = trackAreaRef.current.getBoundingClientRect();
      const deltaProgress = (moveEvent.clientX - state.startX) / Math.max(rect.width, 1);
      let nextStart = state.initialStart;
      let nextEnd = state.initialEnd;
      if (state.type === "move") {
        const duration = state.initialEnd - state.initialStart;
        nextStart = snap(state.initialStart + deltaProgress);
        nextEnd = nextStart + duration;
        if (nextEnd > 1) {
          nextEnd = 1;
          nextStart = Math.max(0, nextEnd - duration);
        }
        const candidateTrack = detectDropTrack(moveEvent.clientY);
        dropTrackRef.current = candidateTrack;
        setDropTrack(candidateTrack);
      } else if (state.type === "resize-start") {
        nextStart = snap(Math.min(state.initialEnd - MIN_CLIP_PROGRESS, state.initialStart + deltaProgress));
        dropTrackRef.current = null;
        setDropTrack(null);
      } else if (state.type === "resize-end") {
        nextEnd = snap(Math.max(state.initialStart + MIN_CLIP_PROGRESS, state.initialEnd + deltaProgress));
        dropTrackRef.current = null;
        setDropTrack(null);
      }
      onClipTimingChange(state.clipId, { start: clampProgress(nextStart), end: clampProgress(nextEnd) });
    };

    const handleUp = () => {
      const state = dragStateRef.current;
      if (state?.type === "move" && state.trackType !== "section" && dropTrackRef.current && dropTrackRef.current !== state.trackType) {
        onMoveClipToTrack(state.clipId, dropTrackRef.current);
      }
      dragStateRef.current = null;
      dropTrackRef.current = null;
      setDropTrack(null);
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
        {frameStrip.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            className="relative h-full flex-1 overflow-hidden border-r last:border-r-0 cursor-pointer transition-opacity hover:opacity-100"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
            onClick={(event) => {
              event.stopPropagation();
              const local = frameStrip.length <= 1 ? 0 : index / (frameStrip.length - 1);
              onPlayheadChange(clampProgress(clip.start + local * (clip.end - clip.start)));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" draggable={false} />
          </button>
        ))}
      </div>
    );
  }

  function renderTrack(track: TimelineTrackModel | undefined, options?: { tint?: string; frameStrip?: boolean }) {
    if (!track) return <div className="relative h-14" style={{ width: totalW }} />;
    return (
      <div className="relative h-14" style={{ width: totalW }}>
        {track.clips.map((clip, index) => {
          const left = clip.start * totalW;
          const width = Math.max(14, (clip.end - clip.start) * totalW);
          const isSelected = selection?.clipId === clip.id;
          const frameStrip = options?.frameStrip ? clip.metadata?.frameStrip : undefined;
          const isMoving = dragStateRef.current?.clipId === clip.id && dragStateRef.current.type === "move";
          const nextClip = track.clips[index + 1];
          const seamLeft = nextClip ? clip.end * totalW : null;
          const transitionPreset = clip.metadata?.transitionPreset;
          const transitionLabel = transitionPreset ? transitionPreset.replace(/-/g, " ") : "Add transition";
          return (
            <Fragment key={clip.id}>
            <div
              tabIndex={0}
              className="motionroll-clip group absolute top-2 h-10 select-none rounded-md border transition-[background,border-color,box-shadow,transform] duration-150 hover:-translate-y-[1px] hover:border-[rgba(255,255,255,0.14)] cursor-grab active:cursor-grabbing"
              style={{
                left,
                width,
                background: frameStrip ? "#0c1118" : isSelected ? "rgba(103,232,249,0.18)" : options?.tint ?? "rgba(255,255,255,0.05)",
                borderColor: isSelected ? "var(--editor-accent)" : "rgba(255,255,255,0.08)",
                boxShadow: isSelected ? "0 0 0 1px rgba(103,232,249,0.25), 0 8px 24px rgba(0,0,0,0.22)" : isMoving ? "0 12px 28px rgba(0,0,0,0.24)" : "inset 0 1px 0 rgba(255,255,255,0.02)",
                color: "var(--editor-text)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectionChange({ clipId: clip.id, trackType: track.type });
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                beginDrag(e, "move", clip.id, track.type, clip.start, clip.end);
              }}
            >
              {frameStrip ? renderFrameStrip(frameStrip, clip) : null}
              <div className="relative z-[1] flex h-full items-center justify-between gap-2 px-2">
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-white drop-shadow-sm">{clip.label ?? clip.id}</span>
                  {!frameStrip && clip.metadata?.contentType ? (
                    <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.56)" }}>
                      {clip.metadata.contentType}
                    </span>
                  ) : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(10,10,12,0.45)] text-[var(--editor-text-dim)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[rgba(255,255,255,0.08)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] cursor-pointer"
                      style={{ opacity: isSelected ? 1 : undefined }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Ellipsis className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onDuplicateClip(clip.id)}>Duplicate</DropdownMenuItem>
                    {track.type !== "section" ? (
                      <DropdownMenuItem onClick={() => onMoveClipToTrack(clip.id, track.type === "overlay" ? "moment" : "overlay")}>
                        Move to {track.type === "overlay" ? "Moments" : "Content"}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => onDeleteClip(clip.id)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div
                className="timeline-resize-handle absolute inset-y-0 left-0 z-[2] w-2 rounded-l-md cursor-ew-resize transition-opacity"
                style={{ background: "rgba(191,227,255,0.55)", opacity: isSelected ? 0.9 : 0 }}
                onMouseDown={(e) => beginDrag(e, "resize-start", clip.id, track.type, clip.start, clip.end)}
              />
              <div
                className="timeline-resize-handle absolute inset-y-0 right-0 z-[2] w-2 rounded-r-md cursor-ew-resize transition-opacity"
                style={{ background: "rgba(191,227,255,0.55)", opacity: isSelected ? 0.9 : 0 }}
                onMouseDown={(e) => beginDrag(e, "resize-end", clip.id, track.type, clip.start, clip.end)}
              />
            </div>
            {nextClip && track.type !== "section" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group absolute top-1/2 z-[3] flex h-6 -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border px-2 text-[10px] font-medium capitalize transition-colors hover:bg-[var(--editor-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] cursor-pointer"
                    style={{
                      left: seamLeft ?? 0,
                      background: transitionPreset ? "rgba(103,232,249,0.1)" : "rgba(12,16,22,0.9)",
                      borderColor: transitionPreset ? "rgba(103,232,249,0.45)" : "rgba(255,255,255,0.08)",
                      color: transitionPreset ? "var(--editor-accent)" : "var(--editor-text-dim)",
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectionChange({ clipId: clip.id, trackType: track.type });
                    }}
                    title={transitionPreset ? `Transition: ${transitionLabel}` : "Choose transition"}
                  >
                    <Plus className="h-3 w-3" />
                    <span className="hidden sm:inline">{transitionLabel}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top">
                  <DropdownMenuLabel>Transition</DropdownMenuLabel>
                  {(["fade", "crossfade", "wipe", "zoom-dissolve", "blur-dissolve"] as const).map((preset) => (
                    <DropdownMenuItem
                      key={preset}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectionChange({ clipId: clip.id, trackType: track.type });
                        onSetClipTransitionPreset(clip.id, preset);
                      }}
                    >
                      <span className="capitalize">{preset.replace(/-/g, " ")}</span>
                      {transitionPreset === preset ? <span className="ml-auto text-[var(--editor-accent)]">Current</span> : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectionChange({ clipId: clip.id, trackType: track.type });
                      onSetClipTransitionPreset(clip.id, undefined);
                    }}
                  >
                    Clear transition
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--editor-panel)" }}>
      <style>{`.timeline-scroll{scrollbar-width:none}.timeline-scroll::-webkit-scrollbar{display:none}.motionroll-clip:focus-visible{outline:none;box-shadow:0 0 0 1px rgba(103,232,249,.55),0 0 0 3px rgba(103,232,249,.12)}`}</style>
      <PlaybackStrip
        playhead={playhead}
        duration={durationSeconds}
        isPlaying={isPlaying}
        onFrameChange={onPlayheadChange}
        onTogglePlay={onPlayToggle}
      />
      <div ref={scrollRef} className="timeline-scroll relative min-h-0 flex-1 overflow-auto" onClick={(e)=>seekFromPointer(e.clientX)}>
        <div style={{ minWidth: totalW + LABEL_W }}>
          <div className="sticky top-0 z-10 flex border-b" style={{ background: "var(--editor-panel-elevated)", borderColor: "var(--editor-border)" }}>
            <div className="flex h-8 w-[184px] shrink-0 items-center border-r px-4 text-[11px] uppercase tracking-[0.14em]" style={{ borderColor: "var(--editor-border)", color: "var(--editor-text-dim)" }}>
              Timeline
            </div>
            <div ref={trackAreaRef} className="relative h-8 flex-1">
              {Array.from({ length: rulerTicks + 1 }).map((_, i) => {
                const x = (i / Math.max(durationSeconds, 1)) * totalW;
                return (
                  <button
                    key={i}
                    type="button"
                    className="absolute top-0 flex h-full items-end cursor-pointer"
                    style={{ left: x }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayheadChange(clampProgress(i / Math.max(durationSeconds, 1)));
                    }}
                  >
                    <div className="h-2.5 w-px" style={{ background: "rgba(255,255,255,0.14)" }} />
                    <span className="ml-1 text-[10px]" style={{ color: "var(--editor-text-dim)" }}>{formatTime(i)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <TimelineRow label="Sequence" rowRef={(node) => (rowRefs.current.section = node)}>{renderTrack(sectionTrack, { frameStrip: true })}</TimelineRow>
          <TimelineRow label="Content" onAdd={onAddAtPlayhead} activeDrop={dropTrack === "overlay"} rowRef={(node) => (rowRefs.current.overlay = node)}>{renderTrack(contentTrack, { tint: "rgba(255,255,255,0.06)" })}</TimelineRow>
          <TimelineRow label="Moments" onAdd={onAddAtPlayhead} activeDrop={dropTrack === "moment"} rowRef={(node) => (rowRefs.current.moment = node)}>{renderTrack(momentsTrack, { tint: "rgba(103,232,249,0.08)" })}</TimelineRow>
        </div>

        <div
          className="pointer-events-none absolute top-0 bottom-0 z-20 w-px"
          style={{ left: playheadX, background: "var(--editor-playhead)", boxShadow: "0 0 8px rgba(103,232,249,0.45)" }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 h-0 w-0"
            style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "6px solid var(--editor-playhead)" }}
          />
        </div>
      </div>
    </div>
  );
}
