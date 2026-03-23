/**
 * TimelineScrollArea — the horizontally / vertically scrollable
 * region that contains the ruler, tracks, and playhead.
 *
 * Accepts a ref so the parent can imperatively scroll during playback.
 */
import React, { forwardRef } from "react";

type TimelineScrollAreaProps = {
  children: React.ReactNode;
  minWidth: number;
};

export const TimelineScrollArea = forwardRef<HTMLDivElement, TimelineScrollAreaProps>(
  function TimelineScrollArea({ children, minWidth }, ref) {
    return (
      <div
        ref={ref}
        className="timeline-scroll relative min-h-0 flex-1 overflow-auto"
      >
        <div className="relative" style={{ minWidth }}>
          {children}
        </div>
      </div>
    );
  },
);
TimelineScrollArea.displayName = "TimelineScrollArea";
