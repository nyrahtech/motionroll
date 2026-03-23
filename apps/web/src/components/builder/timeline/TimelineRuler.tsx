/**
 * TimelineRuler — the time ruler header row above the tracks.
 * Memoized: only re-renders when totalW or durationSeconds changes.
 * Playhead position changes do NOT trigger a re-render here.
 */
import React, { type MutableRefObject, type RefObject } from "react";

type TimelineRulerProps = {
  totalW: number;
  durationSeconds: number;
  labelW: number;
  /** Progress [0–1] of the current playhead — rendered inline, no state. */
  playheadProgress: number;
  onPlayheadPointerDown: (e: React.PointerEvent) => void;
  /** Ref forwarded to the tick-mark/scrub area for playhead pointer down. */
  trackAreaRef?: RefObject<HTMLDivElement | null> | MutableRefObject<HTMLDivElement | null>;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function TimelineRulerInner({
  totalW,
  durationSeconds,
  labelW,
  playheadProgress,
  onPlayheadPointerDown,
  trackAreaRef,
}: TimelineRulerProps) {
  const rulerTicks = Math.max(6, Math.ceil(durationSeconds));

  return (
    <div
      className="sticky top-0 z-[44] flex border-b"
      style={{
        background: "var(--editor-panel-elevated)",
        borderColor: "var(--editor-border)",
      }}
    >
      {/* Layer label cell */}
      <div
        className="sticky left-0 z-20 flex h-8 shrink-0 items-center border-r px-3"
        style={{
          width: labelW,
          borderColor: "var(--editor-border)",
          background: "var(--editor-panel-elevated)",
        }}
      >
        <span
          className="truncate text-[10px] font-medium uppercase tracking-[0.12em]"
          style={{ color: "var(--editor-text-dim)" }}
        >
          Layers
        </span>
      </div>

      {/* Tick marks + scrub zone */}
      <div
        ref={trackAreaRef}
        className="relative h-8 flex-1 cursor-ew-resize"
        title="Click or drag to scrub"
        onPointerDown={onPlayheadPointerDown}
      >
        {Array.from({ length: rulerTicks + 1 }).map((_, i) => {
          const x = (i / Math.max(durationSeconds, 1)) * totalW;
          return (
            <div
              key={i}
              className="pointer-events-none absolute top-0 flex h-full items-end"
              style={{ left: x }}
            >
              <div
                className="h-2.5 w-px"
                style={{ background: "rgba(255,255,255,0.14)" }}
              />
              <span
                className="ml-1 text-[10px]"
                style={{ color: "var(--editor-text-dim)" }}
              >
                {formatTime(i)}
              </span>
            </div>
          );
        })}

        {/* Wider invisible hit-target centred on the playhead */}
        <div
          className="pointer-events-auto absolute inset-y-0 z-[46] w-5 -translate-x-1/2 cursor-ew-resize"
          style={{ left: playheadProgress * totalW }}
          onPointerDown={onPlayheadPointerDown}
          title="Drag to scrub"
        />
      </div>
    </div>
  );
}

export const TimelineRuler = React.memo(TimelineRulerInner, (prev, next) => {
  // Skip re-render when only the playhead moved — the hit-target
  // repositioning is handled by the parent absolutely-positioned element.
  return (
    prev.totalW === next.totalW &&
    prev.durationSeconds === next.durationSeconds &&
    prev.labelW === next.labelW &&
    prev.onPlayheadPointerDown === next.onPlayheadPointerDown
  );
});
TimelineRuler.displayName = "TimelineRuler";
