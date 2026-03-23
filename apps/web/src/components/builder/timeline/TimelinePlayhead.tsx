/**
 * TimelinePlayhead — the vertical line + triangle indicator.
 *
 * Intentionally NOT memoized: its only prop is playheadX which
 * changes every animation frame during playback. Keeping it as a
 * tiny leaf avoids diff cost on larger ancestors.
 */
import React from "react";

type TimelinePlayheadProps = {
  playheadX: number;
};

export function TimelinePlayhead({ playheadX }: TimelinePlayheadProps) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-[12] w-5 -translate-x-1/2"
      style={{ left: playheadX }}
    >
      {/* Vertical line */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2"
        style={{
          background: "var(--editor-playhead)",
          boxShadow: "0 0 8px rgba(103,232,249,0.45)",
        }}
      />
      {/* Triangle head */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2"
        style={{
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "8px solid var(--editor-playhead)",
        }}
      />
    </div>
  );
}
