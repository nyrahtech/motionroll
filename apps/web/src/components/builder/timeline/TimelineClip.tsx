/**
 * TimelineClip — a single clip bar on the timeline.
 *
 * Wrapped in React.memo with a custom comparator that ignores
 * playheadProgress so clip bars don't re-render during scrubbing.
 *
 * Drag state (resize handles, move ghost) is owned LOCALLY here,
 * not propagated upward until a commit event fires.
 */
import React from "react";
import type { TimelineClipModel, TimelineTrackType } from "../timeline-model";

type TimelineClipProps = {
  clip: TimelineClipModel;
  trackType: TimelineTrackType;
  totalW: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  isDraggable: boolean;
  frameStrip?: string[];
  previewStart?: number;
  previewEnd?: number;
  tint?: string;
  stackZIndex?: number;
  /** Render-only: provided by parent so clip can show frame thumbnails */
  onFrameClick?: (progress: number) => void;
  onPointerDown?: (e: React.PointerEvent, clip: TimelineClipModel, mode: "move" | "resize-start" | "resize-end") => void;
  onClick?: (e: React.MouseEvent, clip: TimelineClipModel) => void;
  onContextMenu?: (e: React.MouseEvent, clip: TimelineClipModel) => void;
};

const RESIZE_HANDLE_WIDTH = 10;

function TimelineClipInner({
  clip,
  trackType,
  totalW,
  isSelected,
  isMultiSelected,
  isDraggable,
  frameStrip,
  previewStart,
  previewEnd,
  tint,
  stackZIndex = 10,
  onFrameClick,
  onPointerDown,
  onClick,
  onContextMenu,
}: TimelineClipProps) {
  const clipStart = previewStart ?? clip.start;
  const clipEnd = previewEnd ?? clip.end;
  const left = clipStart * totalW;
  const width = Math.max(14, (clipEnd - clipStart) * totalW);
  const isSelectionVisible = isSelected || isMultiSelected;
  const transitionLabel = clip.metadata?.transitionPreset?.replace(/-/g, " ") ?? null;

  const accentColor =
    clip.tint === "accent"
      ? "rgba(103,232,249,0.18)"
      : trackType === "section"
        ? "rgba(103,232,249,0.22)"
        : undefined;

  return (
    <div
      tabIndex={0}
      role="button"
      aria-selected={isSelectionVisible}
      aria-label={clip.label}
      className="motionroll-clip group absolute top-3 h-10 select-none rounded-md border transition-[background,border-color,box-shadow,transform,opacity] duration-150 hover:-translate-y-[1px] hover:border-[rgba(255,255,255,0.14)]"
      style={{
        left,
        width,
        zIndex: stackZIndex,
        background: frameStrip
          ? "transparent"
          : accentColor ?? (isSelectionVisible ? "rgba(103,232,249,0.18)" : (tint ?? "rgba(255,255,255,0.06)")),
        borderColor: isSelected
          ? "rgba(103,232,249,0.72)"
          : isMultiSelected
          ? "rgba(103,232,249,0.45)"
          : "rgba(255,255,255,0.10)",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(103,232,249,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
          : undefined,
      }}
      onPointerDown={
        isDraggable && onPointerDown
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const localX = e.clientX - rect.left;
              const mode =
                localX <= RESIZE_HANDLE_WIDTH
                  ? "resize-start"
                  : localX >= rect.width - RESIZE_HANDLE_WIDTH
                  ? "resize-end"
                  : "move";
              onPointerDown(e, clip, mode);
            }
          : undefined
      }
      onClick={onClick ? (e) => onClick(e, clip) : undefined}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, clip) : undefined}
    >
      {/* Frame thumbnail strip */}
      {frameStrip && frameStrip.length > 0 ? (
        <div className="absolute inset-0 flex overflow-hidden rounded-md">
          {frameStrip.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              className="relative h-full flex-1 overflow-hidden border-r last:border-r-0 transition-opacity hover:opacity-100"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
              onClick={(ev) => {
                ev.stopPropagation();
                if (onFrameClick) {
                  const local = frameStrip.length <= 1 ? 0 : i / (frameStrip.length - 1);
                  onFrameClick(Math.max(0, Math.min(1, clip.start + local * (clip.end - clip.start))));
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover opacity-90"
                draggable={false}
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* Clip label + transition tag */}
      <div className="pointer-events-none absolute inset-x-2 inset-y-0 flex items-center justify-between gap-1 overflow-hidden">
        <span
          className="truncate text-xs font-medium leading-none"
          style={{
            color: isSelectionVisible ? "rgba(103,232,249,0.95)" : "var(--editor-text)",
          }}
        >
          {clip.label}
        </span>
        {transitionLabel ? (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em]"
            style={{
              background: "rgba(103,232,249,0.12)",
              color: "rgba(103,232,249,0.75)",
            }}
          >
            {transitionLabel}
          </span>
        ) : null}
      </div>

      {/* Resize handles — only shown when hovered or selected */}
      {isDraggable ? (
        <>
          <div
            className="absolute left-0 top-0 h-full cursor-ew-resize rounded-l-md opacity-0 transition-opacity group-hover:opacity-100"
            style={{
              width: RESIZE_HANDLE_WIDTH,
              background:
                "linear-gradient(to right, rgba(255,255,255,0.08), transparent)",
            }}
          />
          <div
            className="absolute right-0 top-0 h-full cursor-ew-resize rounded-r-md opacity-0 transition-opacity group-hover:opacity-100"
            style={{
              width: RESIZE_HANDLE_WIDTH,
              background:
                "linear-gradient(to left, rgba(255,255,255,0.08), transparent)",
            }}
          />
        </>
      ) : null}
    </div>
  );
}

export const TimelineClip = React.memo(TimelineClipInner, (prev, next) => {
  // Skip re-render if only the playhead changed — clips don't care.
  return (
    prev.clip === next.clip &&
    prev.totalW === next.totalW &&
    prev.isSelected === next.isSelected &&
    prev.isMultiSelected === next.isMultiSelected &&
    prev.isDraggable === next.isDraggable &&
    prev.frameStrip === next.frameStrip &&
    prev.previewStart === next.previewStart &&
    prev.previewEnd === next.previewEnd &&
    prev.tint === next.tint &&
    prev.stackZIndex === next.stackZIndex &&
    prev.onFrameClick === next.onFrameClick &&
    prev.onPointerDown === next.onPointerDown &&
    prev.onClick === next.onClick &&
    prev.onContextMenu === next.onContextMenu
  );
});
TimelineClip.displayName = "TimelineClip";
