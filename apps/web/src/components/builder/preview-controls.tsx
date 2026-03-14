"use client";

import { Maximize2, MonitorSmartphone, MonitorUp, MoonStar, Pause, Play } from "lucide-react";
import { getTimelineTimeLabel } from "./timeline-model";

export function PreviewControls({
  mode,
  reducedMotion,
  playhead,
  durationSeconds,
  isPlaying,
  onModeChange,
  onReducedMotionChange,
  onSeek,
  onPlayToggle,
  onFullscreen,
}: {
  mode: "desktop" | "mobile";
  reducedMotion: boolean;
  playhead: number;
  durationSeconds: number;
  isPlaying: boolean;
  onModeChange: (mode: "desktop" | "mobile") => void;
  onReducedMotionChange: (value: boolean) => void;
  onSeek: (progress: number) => void;
  onPlayToggle: () => void;
  onFullscreen: () => void;
}) {
  return (
    <div className="mt-2 rounded-[7px] bg-[rgba(255,255,255,0.03)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPlayToggle}
            className="focus-ring flex h-7 items-center gap-1.5 rounded-[7px] bg-white px-2.5 text-xs font-medium text-black"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <span className="text-xs text-white">{getTimelineTimeLabel(playhead, durationSeconds)}</span>
          <span className="text-xs text-[var(--foreground-faint)]">{getTimelineTimeLabel(1, durationSeconds)}</span>
        </div>

        <div className="flex items-center gap-1 text-[var(--foreground-muted)]">
          <button
            type="button"
            onClick={() => onModeChange("desktop")}
            className={`focus-ring rounded-[6px] p-1 ${mode === "desktop" ? "bg-[rgba(255,255,255,0.05)] text-white" : ""}`}
          >
            <MonitorUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onModeChange("mobile")}
            className={`focus-ring rounded-[6px] p-1 ${mode === "mobile" ? "bg-[rgba(255,255,255,0.05)] text-white" : ""}`}
          >
            <MonitorSmartphone className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onReducedMotionChange(!reducedMotion)}
            className={`focus-ring rounded-[6px] p-1 ${reducedMotion ? "bg-[rgba(255,255,255,0.05)] text-white" : ""}`}
          >
            <MoonStar className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onFullscreen}
            className="focus-ring rounded-[6px] p-1 hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={playhead}
        onChange={(event) => onSeek(Number(event.target.value))}
        className="mt-2.5 w-full accent-[var(--timeline-selected)]"
      />
    </div>
  );
}
