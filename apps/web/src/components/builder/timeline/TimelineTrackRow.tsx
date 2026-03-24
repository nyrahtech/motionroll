/**
 * TimelineTrackRow — renders a single track's clip bars.
 *
 * Extracted from timeline-panel's renderTrack/renderFrameStrip closures.
 * Memoized with a comparator that ignores playhead so clip DOM doesn't
 * re-render during scrubbing.
 */
"use client";

import React, { Fragment, type MouseEvent } from "react";
import { Check, Ellipsis, Layers3 } from "lucide-react";
import { clampProgress, type OverlayAnimationType } from "@motionroll/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import type {
  TimelineClipModel,
  TimelineSelection,
  TimelineTrackModel,
} from "../timeline-model";
import { TIMELINE_START_OFFSET } from "../timeline-layout";

type SceneTransitionPreset =
  "none" | "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve";

export type TimelineTrackRowProps = {
  track: TimelineTrackModel | undefined;
  totalW: number;
  tint?: string;
  showFrameStrip?: boolean;
  draggable?: boolean;
  layerTrackIndex?: number;
  // Selection state
  selection: TimelineSelection;
  selectedClipIds: string[];
  // Drag state
  draggingClipId: string | null;
  draggingClipMode: "move" | "resize-start" | "resize-end" | null;
  clipTimingPreview: { clipId: string; start: number; end: number } | null;
  frameStripCache: Map<string, string[]>;
  // Actions (all stable refs)
  canGroupSelection: boolean;
  layerTracks: TimelineTrackModel[];
  onPlayheadChange: (value: number) => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  onMoveClipToNewLayer: (clipId: string) => void;
  onMoveClipToLayer: (clipId: string, layerIndex: number) => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onSetClipEnterAnimationType: (clipId: string, type: OverlayAnimationType) => void;
  onSetClipExitAnimationType: (clipId: string, type: OverlayAnimationType) => void;
  onOpenSceneAnimation?: () => void;
  onSetSceneTransitionPreset?: (preset: SceneTransitionPreset) => void;
  // Drag handlers (stable refs from parent)
  shouldSuppressClick: () => boolean;
  beginClipDrag: (
    e: React.MouseEvent,
    type: "move" | "resize-start" | "resize-end",
    clip: TimelineClipModel,
    layerTrackIndex?: number,
  ) => void;
};

function TimelineTrackRowInner({
  track,
  totalW,
  tint,
  showFrameStrip = false,
  draggable = true,
  layerTrackIndex,
  selection,
  selectedClipIds,
  draggingClipId,
  draggingClipMode,
  clipTimingPreview,
  frameStripCache,
  canGroupSelection,
  layerTracks,
  onPlayheadChange,
  onGroupSelection,
  onUngroupSelection,
  onMoveClipToNewLayer,
  onMoveClipToLayer,
  onDuplicateClip,
  onDeleteClip,
  onSetClipEnterAnimationType,
  onSetClipExitAnimationType,
  onOpenSceneAnimation,
  onSetSceneTransitionPreset,
  shouldSuppressClick,
  beginClipDrag,
}: TimelineTrackRowProps) {
  if (!track) {
    return <div className="relative h-14" style={{ width: totalW + TIMELINE_START_OFFSET }} />;
  }
  const resolvedTrack = track;

  const animationTypeItems: Array<{ type: OverlayAnimationType; label: string }> = [
    { type: "none", label: "None" },
    { type: "fade", label: "Fade" },
    { type: "slide-up-fade", label: "Slide up + fade" },
    { type: "slide-left-fade", label: "Slide left + fade" },
    { type: "scale-fade", label: "Scale + fade" },
  ];
  const sceneTransitionItems: Array<{
    preset: SceneTransitionPreset;
    label: string;
  }> = [
    { preset: "none", label: "None" },
    { preset: "fade", label: "Fade" },
    { preset: "crossfade", label: "Crossfade" },
    { preset: "wipe", label: "Wipe" },
    { preset: "zoom-dissolve", label: "Zoom dissolve" },
    { preset: "blur-dissolve", label: "Blur dissolve" },
  ];

  function renderFrameStrip(frameStrip: string[], clip: TimelineClipModel) {
    const fallbackUrl = clip.metadata?.frameStripSource?.fallbackUrl;

    return (
      <div className="absolute inset-0 flex overflow-hidden rounded-md">
        {frameStrip.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            className="relative h-full flex-1 overflow-hidden border-r last:border-r-0 transition-opacity hover:opacity-100"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
            onClick={(ev) => {
              if (shouldSuppressClick()) { ev.preventDefault(); ev.stopPropagation(); return; }
              ev.stopPropagation();
              const local = frameStrip.length <= 1 ? 0 : i / (frameStrip.length - 1);
              onPlayheadChange(clampProgress(clip.start + local * (clip.end - clip.start)));
            }}
            >
            <TimelineStripImage url={url} fallbackUrl={fallbackUrl} />
          </button>
        ))}
      </div>
    );
  }

  function renderClipMenuContent(clip: TimelineClipModel) {
    if (resolvedTrack.type === "section") {
      return (
        <>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Animation</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {sceneTransitionItems.map((item) => (
                <DropdownMenuItem
                  key={`scene-transition-${item.preset}`}
                  onClick={() => onSetSceneTransitionPreset?.(item.preset)}
                >
                  {clip.metadata?.sceneTransitionPreset === item.preset ? (
                    <Check className="h-3.5 w-3.5 text-[var(--editor-accent)]" />
                  ) : (
                    <span className="w-3.5" />
                  )}
                  <span>{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => onOpenSceneAnimation?.()}>Scene settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled variant="destructive">
            Delete
          </DropdownMenuItem>
        </>
      );
    }

    return (
      <>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Enter animation</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {animationTypeItems.map((item) => (
              <DropdownMenuItem
                key={`enter-${clip.id}-${item.type}`}
                onClick={() => onSetClipEnterAnimationType(clip.id, item.type)}
              >
                {clip.metadata?.enterAnimationType === item.type ? <Check className="h-3.5 w-3.5 text-[var(--editor-accent)]" /> : <span className="w-3.5" />}
                <span>{item.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Exit animation</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {animationTypeItems.map((item) => (
              <DropdownMenuItem
                key={`exit-${clip.id}-${item.type}`}
                onClick={() => onSetClipExitAnimationType(clip.id, item.type)}
              >
                {clip.metadata?.exitAnimationType === item.type ? <Check className="h-3.5 w-3.5 text-[var(--editor-accent)]" /> : <span className="w-3.5" />}
                <span>{item.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {canGroupSelection ? <DropdownMenuSeparator /> : null}
        {canGroupSelection ? <DropdownMenuItem onClick={onGroupSelection}>Group</DropdownMenuItem> : null}
        {clip.metadata?.isGroup ? <DropdownMenuItem onClick={onUngroupSelection}>Ungroup</DropdownMenuItem> : null}
        {layerTracks.length > 1 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onClick={() => onMoveClipToNewLayer(clip.id)}>Move to New layer</DropdownMenuItem>
        {layerTracks
          .filter((lt) => lt.id !== resolvedTrack.id)
          .map((lt) => (
            <DropdownMenuItem
              key={`${clip.id}-${lt.id}`}
              onClick={() => {
                if (typeof lt.metadata?.layerIndex === "number") {
                  onMoveClipToLayer(clip.id, lt.metadata.layerIndex);
                }
              }}
            >
              Move to {lt.label}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDuplicateClip(clip.id)}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDeleteClip(clip.id)}>Delete</DropdownMenuItem>
      </>
    );
  }

  function renderClipMenuTrigger(
    clip: TimelineClipModel,
    isVisible: boolean,
    align: "start" | "end" = "end",
  ) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Open clip actions"
            aria-label="Open clip actions"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgba(10,10,12,0.45)] text-[var(--editor-text-dim)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[rgba(255,255,255,0.08)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
            style={{ opacity: isVisible ? 1 : undefined }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <Ellipsis className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          {renderClipMenuContent(clip)}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="relative h-14" style={{ width: totalW + TIMELINE_START_OFFSET }}>
      {track.clips.map((clip) => {
        const previewTiming = clipTimingPreview?.clipId === clip.id ? clipTimingPreview : null;
        const clipStart = previewTiming?.start ?? clip.start;
        const clipEnd = previewTiming?.end ?? clip.end;
        const left = TIMELINE_START_OFFSET + clipStart * totalW;
        const width = Math.max(14, (clipEnd - clipStart) * totalW);
        const isSelected = selection?.clipId === clip.id;
        const isMultiSelected = selectedClipIds.includes(clip.id);
        const isSelectionVisible = isSelected || isMultiSelected;
        const frameStrip = showFrameStrip ? frameStripCache.get(clip.id) : undefined;
        const isMoveDragging = draggingClipId === clip.id && draggingClipMode === "move";
        const clipStackIndex = resolvedTrack.clips.findIndex((entry) => entry.id === clip.id);
        const stackZIndex = resolvedTrack.type === "section" ? 2 : isMoveDragging ? 40 : isSelected ? 30 : 10 + clipStackIndex;
        const isDraggable = draggable && resolvedTrack.type !== "section";

        return (
          <Fragment key={clip.id}>
            <div
              tabIndex={0}
              className="motionroll-clip group absolute top-3 h-10 select-none rounded-md border transition-[background,border-color,box-shadow,transform,opacity] duration-150 hover:-translate-y-[1px] hover:border-[rgba(255,255,255,0.14)]"
              style={{
                left,
                width,
                zIndex: stackZIndex,
                background: frameStrip
                  ? "#0c1118"
                  : clip.metadata?.isGroup
                    ? isSelectionVisible ? "rgba(103,232,249,0.16)" : "rgba(205,239,255,0.08)"
                    : isSelected
                      ? "rgba(103,232,249,0.18)"
                      : tint ?? "rgba(255,255,255,0.05)",
                borderColor: isSelectionVisible ? "var(--editor-accent)" : "rgba(255,255,255,0.08)",
                borderStyle: clip.metadata?.isGroup ? "dashed" : "solid",
                boxShadow: isMoveDragging
                  ? "0 0 0 1px rgba(103,232,249,0.45), 0 12px 30px rgba(0,0,0,0.28)"
                  : isSelectionVisible
                    ? "0 0 0 1px rgba(103,232,249,0.25), 0 8px 24px rgba(0,0,0,0.22)"
                    : "inset 0 1px 0 rgba(255,255,255,0.02)",
                color: "var(--editor-text)",
                opacity: isMoveDragging ? 0.24 : 1,
                transform: isMoveDragging ? "translateY(-1px) scale(1.01)" : undefined,
              }}
              onClick={(ev) => {
                if (shouldSuppressClick()) { ev.preventDefault(); ev.stopPropagation(); return; }
                ev.stopPropagation();
                const rect = ev.currentTarget.getBoundingClientRect();
                const local = clampProgress((ev.clientX - rect.left) / Math.max(rect.width, 1));
                onPlayheadChange(clampProgress(clip.start + local * (clip.end - clip.start)));
              }}
              onMouseDown={isDraggable ? (ev) => beginClipDrag(ev, "move", clip, layerTrackIndex) : undefined}
            >
              {frameStrip ? renderFrameStrip(frameStrip, clip) : null}

              <div className="relative z-[1] flex h-full items-center justify-between gap-2 px-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {resolvedTrack.type === "section" ? renderClipMenuTrigger(clip, isSelectionVisible, "start") : null}
                    {clip.metadata?.isGroup ? (
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ background: "rgba(205,239,255,0.08)", color: "var(--editor-accent)" }}>
                        <Layers3 className="h-3 w-3" />
                      </span>
                    ) : null}
                    <span className="block truncate text-xs font-medium text-white">{clip.label ?? clip.id}</span>
                  </div>
                  {clip.metadata?.isGroup ? (
                    <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.56)" }}>
                      {clip.metadata.childCount ?? 0} items
                    </span>
                  ) : !frameStrip && clip.metadata?.contentType ? (
                    <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.56)" }}>{clip.metadata.contentType}</span>
                  ) : null}
                </div>

                {renderClipMenuTrigger(clip, isSelectionVisible)}
              </div>

              {/* Resize handles */}
              <div
                className="timeline-resize-handle absolute inset-y-0 left-0 z-[2] w-2 rounded-l-md cursor-ew-resize"
                style={{ background: "rgba(191,227,255,0.55)", opacity: isSelected ? 0.95 : 0 }}
                onMouseDown={(ev) => beginClipDrag(ev, "resize-start", clip, layerTrackIndex)}
              />
              <div
                className="timeline-resize-handle absolute inset-y-0 right-0 z-[2] w-2 rounded-r-md cursor-ew-resize"
                style={{ background: "rgba(191,227,255,0.55)", opacity: isSelected ? 0.95 : 0 }}
                onMouseDown={(ev) => beginClipDrag(ev, "resize-end", clip, layerTrackIndex)}
              />
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function TimelineStripImage({
  url,
  fallbackUrl,
}: {
  url: string;
  fallbackUrl?: string;
}) {
  const [src, setSrc] = React.useState(url);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    setSrc(url);
    setHidden(false);
  }, [url]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover opacity-90"
      draggable={false}
      style={hidden ? { visibility: "hidden" } : undefined}
      onError={() => {
        if (!hidden && fallbackUrl && src !== fallbackUrl) {
          setSrc(fallbackUrl);
          return;
        }
        setHidden(true);
      }}
    />
  );
}

export const TimelineTrackRow = React.memo(TimelineTrackRowInner, (prev, next) => {
  // Never re-render if only playhead changed — clips don't display it.
  // Re-render when: track data, selection, drag state, or preview state changes.
  return (
    prev.track === next.track &&
    prev.totalW === next.totalW &&
    prev.tint === next.tint &&
    prev.showFrameStrip === next.showFrameStrip &&
    prev.draggable === next.draggable &&
    prev.layerTrackIndex === next.layerTrackIndex &&
    prev.selection === next.selection &&
    prev.selectedClipIds === next.selectedClipIds &&
    prev.draggingClipId === next.draggingClipId &&
    prev.draggingClipMode === next.draggingClipMode &&
    prev.clipTimingPreview === next.clipTimingPreview &&
    prev.frameStripCache === next.frameStripCache &&
    prev.canGroupSelection === next.canGroupSelection &&
    prev.layerTracks === next.layerTracks
    // Note: callback props (onPlayheadChange etc.) are stable refs in the panel,
    // so including them would never cause re-renders anyway.
  );
});
TimelineTrackRow.displayName = "TimelineTrackRow";
