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
  overlay?: React.ReactNode;
};

export const TimelineScrollArea = forwardRef<HTMLDivElement, TimelineScrollAreaProps>(
  function TimelineScrollArea({ children, minWidth, overlay }, ref) {
    return (
      <div
        ref={ref}
        className="timeline-scroll relative min-h-0 flex-1 overflow-auto"
      >
        <div className="relative min-h-full" style={{ minWidth }}>
          {children}
        </div>
        {overlay}
      </div>
    );
  },
);
TimelineScrollArea.displayName = "TimelineScrollArea";
