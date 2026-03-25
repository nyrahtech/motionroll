/**
 * TimelineRuler - the time ruler header row above the tracks.
 * Only the scrub hit-target listens to live playback updates.
 */
import React, { type MutableRefObject, type RefObject } from "react";
import type { EditorPlaybackController } from "../hooks/useEditorPlayback";
import { usePlaybackProgress } from "../hooks/useEditorPlayback";
import { TIMELINE_START_OFFSET } from "../timeline-layout";

type TimelineRulerProps = {
  totalW: number;
  durationSeconds: number;
  labelW: number;
  playback: EditorPlaybackController;
  onPlayheadPointerDown: (e: React.PointerEvent) => void;
  trackAreaRef?: RefObject<HTMLDivElement | null> | MutableRefObject<HTMLDivElement | null>;
  hideLabelColumn?: boolean;
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
  playback,
  onPlayheadPointerDown,
  trackAreaRef,
  hideLabelColumn = false,
}: TimelineRulerProps) {
  const rulerTicks = Math.max(6, Math.ceil(durationSeconds));
  const playheadProgress = usePlaybackProgress(playback);

  return (
    <div
      className="sticky top-0 z-[44] border-b h-8"
      style={{
        background: "var(--editor-panel-elevated)",
        borderColor: "var(--editor-border)",
      }}
    >
      {hideLabelColumn ? null : (
        <div
          className="sticky left-0 z-[60] flex h-8 shrink-0 items-center border-r px-3"
          style={{
            width: labelW,
            borderColor: "var(--editor-border)",
            background: "var(--editor-panel-elevated)",
            boxShadow: "10px 0 0 var(--editor-panel-elevated)",
          }}
        >
          <span
            className="truncate text-[10px] font-medium uppercase tracking-[0.12em]"
            style={{ color: "var(--editor-text-dim)" }}
          >
            Layers
          </span>
        </div>
      )}

      <div
        ref={trackAreaRef}
        className="relative h-8 flex-1 cursor-ew-resize"
        title="Click or drag to scrub"
        onPointerDown={onPlayheadPointerDown}
      >
        {Array.from({ length: rulerTicks + 1 }).map((_, i) => {
          const x = TIMELINE_START_OFFSET + (i / Math.max(durationSeconds, 1)) * totalW;
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
                className="ml-1 select-none text-[10px]"
                style={{ color: "var(--editor-text-dim)" }}
              >
                {formatTime(i)}
              </span>
            </div>
          );
        })}

        <div
          className="pointer-events-auto absolute inset-y-0 z-[46] w-5 -translate-x-1/2 cursor-ew-resize"
          style={{ left: TIMELINE_START_OFFSET + playheadProgress * totalW }}
          onPointerDown={(event) => {
            // Prevent duplicate scrub session start from bubbling to ruler container.
            event.stopPropagation();
            onPlayheadPointerDown(event);
          }}
          title="Drag to scrub"
        />
      </div>
    </div>
  );
}

export const TimelineRuler = React.memo(TimelineRulerInner, (prev, next) => {
  return (
    prev.totalW === next.totalW &&
    prev.durationSeconds === next.durationSeconds &&
    prev.labelW === next.labelW &&
    prev.playback === next.playback &&
    prev.onPlayheadPointerDown === next.onPlayheadPointerDown
  );
});
TimelineRuler.displayName = "TimelineRuler";
