"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers3,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Ungroup,
} from "lucide-react";
import type { EditorPlaybackController } from "./hooks/useEditorPlayback";
import { usePlaybackProgress } from "./hooks/useEditorPlayback";

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

type TimelinePlaybackStripProps = {
  playback: EditorPlaybackController;
  duration: number;
  isPlaying: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canGroupSelection: boolean;
  canUngroupSelection: boolean;
  onFrameChange: (progress: number) => void;
  onTogglePlay: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  onAddLayer: () => void;
};

export function TimelinePlaybackStrip({
  playback,
  duration,
  isPlaying,
  canUndo,
  canRedo,
  canGroupSelection,
  canUngroupSelection,
  onFrameChange,
  onTogglePlay,
  onUndo,
  onRedo,
  onGroupSelection,
  onUngroupSelection,
  onAddLayer,
}: TimelinePlaybackStripProps) {
  const playhead = usePlaybackProgress(playback);
  const currentSec = playhead * duration;
  const buttonClassName = "flex h-8 w-8 items-center justify-center rounded-md text-[var(--editor-text-dim)] transition-colors hover:bg-[var(--editor-hover)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[var(--editor-text-dim)]";

  return (
    <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}>
      <div className="flex min-w-0 items-center gap-1.5 justify-self-start">
        <TimelineControlButton label="Undo" onClick={onUndo} disabled={!canUndo} className={buttonClassName}>
          <RotateCcw className="h-4 w-4" />
        </TimelineControlButton>
        <TimelineControlButton label="Redo" onClick={onRedo} disabled={!canRedo} className={buttonClassName}>
          <RotateCw className="h-4 w-4" />
        </TimelineControlButton>
        <TimelineControlButton label="Add layer" onClick={onAddLayer} className={buttonClassName}>
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
          className={buttonClassName}
        >
          <Layers3 className="h-4 w-4" />
        </TimelineControlButton>
        <TimelineControlButton
          label="Ungroup selected item"
          onClick={onUngroupSelection}
          disabled={!canUngroupSelection}
          className={buttonClassName}
        >
          <Ungroup className="h-4 w-4" />
        </TimelineControlButton>
      </div>
      <div className="flex items-center gap-1 justify-self-center">
        <button type="button" aria-label="Jump to start" title="Jump to start" onClick={() => onFrameChange(0)} className={buttonClassName}><SkipBack className="h-4 w-4" /></button>
        <button type="button" aria-label="Previous frame" title="Previous frame" onClick={() => onFrameChange(Math.max(0, playhead - 1 / Math.max(duration * 24, 1)))} className={buttonClassName}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label={isPlaying ? "Pause playback" : "Start playback"} title={isPlaying ? "Pause playback" : "Start playback"} onClick={onTogglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--editor-selected)] text-[var(--editor-accent)] transition-colors hover:bg-[rgba(103,232,249,0.18)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <button type="button" aria-label="Next frame" title="Next frame" onClick={() => onFrameChange(Math.min(1, playhead + 1 / Math.max(duration * 24, 1)))} className={buttonClassName}><ChevronRight className="h-4 w-4" /></button>
        <button type="button" aria-label="Jump to end" title="Jump to end" onClick={() => onFrameChange(1)} className={buttonClassName}><SkipForward className="h-4 w-4" /></button>
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
