/**
 * TimelinePlayhead — the vertical line + triangle indicator.
 *
 * Intentionally NOT memoized: its only prop is playheadX which
 * changes every animation frame during playback. Keeping it as a
 * tiny leaf avoids diff cost on larger ancestors.
 */
import React from "react";
import type { EditorPlaybackController } from "../hooks/useEditorPlayback";
import { usePlaybackProgress } from "../hooks/useEditorPlayback";
import { TIMELINE_START_OFFSET } from "../timeline-layout";

type TimelinePlayheadProps = {
  playback: EditorPlaybackController;
  totalW: number;
};

export function TimelinePlayhead({ playback, totalW }: TimelinePlayheadProps) {
  const playheadX = TIMELINE_START_OFFSET + usePlaybackProgress(playback) * totalW;

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-[48] w-5 -translate-x-1/2"
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
          borderTop: "10px solid var(--editor-playhead)",
          filter: "drop-shadow(0 0 8px rgba(103,232,249,0.45))",
        }}
      />
    </div>
  );
}
