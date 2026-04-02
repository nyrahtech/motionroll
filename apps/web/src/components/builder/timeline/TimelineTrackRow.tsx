/**
 * TimelineTrackRow renders a single track's clip bars.
 *
 * Section tracks now represent bookmark ranges, while layer tracks keep the
 * existing global layer clip interactions.
 */
"use client";

import React, { Fragment, useEffect, useState } from "react";
import {
  Check,
  Ellipsis,
  Layers3,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import { Input } from "../../ui/input";
import {
  TIMELINE_ADD_BLOCK_PX,
  TimelineClipModel,
  TimelineSelection,
  TimelineTrackModel,
} from "../timeline-model";
import { TIMELINE_START_OFFSET } from "../timeline-layout";
import { TimelineStripImage, TimelineVideoStrip } from "./TimelineTrackRowMedia";

type BookmarkTransitionPreset =
  "none" | "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve";

export type TimelineTrackRowProps = {
  track: TimelineTrackModel | undefined;
  totalW: number;
  tint?: string;
  showFrameStrip?: boolean;
  draggable?: boolean;
  isPlaying: boolean;
  layerTrackIndex?: number;
  selection: TimelineSelection;
  selectedClipIds: string[];
  draggingClipId: string | null;
  draggingClipMode: "move" | "resize-start" | "resize-end" | null;
  clipTimingPreview: { clipId: string; start: number; end: number } | null;
  frameStripCache: Map<string, string[]>;
  canGroupSelection: boolean;
  layerTracks: TimelineTrackModel[];
  onPlayheadChange: (value: number) => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  onMoveClipToNewLayer: (clipId: string) => void;
  onMoveClipToLayer: (clipId: string, layerIndex: number) => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onSelectBookmark?: (bookmarkId: string) => void;
  onRenameBookmark?: (bookmarkId: string, title: string) => void;
  onDuplicateBookmark?: (bookmarkId: string) => void;
  onDeleteBookmark?: (bookmarkId: string) => void;
  onAddBookmark?: () => void;
  onAddBookmarkAfter?: (bookmarkId: string) => void;
  onReorderBookmarks?: (fromBookmarkId: string, toBookmarkId: string) => void;
  onSetClipEnterAnimationType: (clipId: string, type: OverlayAnimationType) => void;
  onSetClipExitAnimationType: (clipId: string, type: OverlayAnimationType) => void;
  onSetBookmarkEnterTransitionPreset?: (bookmarkId: string, preset: BookmarkTransitionPreset) => void;
  onSetBookmarkExitTransitionPreset?: (bookmarkId: string, preset: BookmarkTransitionPreset) => void;
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
  isPlaying,
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
  onSelectBookmark,
  onRenameBookmark,
  onDuplicateBookmark,
  onDeleteBookmark,
  onAddBookmark,
  onAddBookmarkAfter,
  onReorderBookmarks,
  onSetClipEnterAnimationType,
  onSetClipExitAnimationType,
  onSetBookmarkEnterTransitionPreset,
  onSetBookmarkExitTransitionPreset,
  shouldSuppressClick,
  beginClipDrag,
}: TimelineTrackRowProps) {
  const [renamingBookmarkId, setRenamingBookmarkId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(null);

  if (!track) {
    return <div className="relative h-14" style={{ width: totalW + TIMELINE_START_OFFSET }} />;
  }

  const resolvedTrack = track;
  const isBookmarkTrack = resolvedTrack.type === "section";
  const animationTypeItems: Array<{ type: OverlayAnimationType; label: string }> = [
    { type: "none", label: "None" },
    { type: "fade", label: "Fade" },
    { type: "slide-up-fade", label: "Slide up + fade" },
    { type: "slide-left-fade", label: "Slide left + fade" },
    { type: "scale-fade", label: "Scale + fade" },
  ];
  useEffect(() => {
    if (!renamingBookmarkId || !isBookmarkTrack) {
      return;
    }
    const renamingClip = resolvedTrack.clips.find((clip) => clip.metadata?.bookmarkId === renamingBookmarkId);
    if (renamingClip) {
      setRenameValue(renamingClip.label);
    }
  }, [isBookmarkTrack, renamingBookmarkId, resolvedTrack.clips]);

  function startRenameBookmark(clip: TimelineClipModel) {
    const bookmarkId = clip.metadata?.bookmarkId;
    if (!bookmarkId) return;
    setRenamingBookmarkId(bookmarkId);
    setRenameValue(clip.label);
  }

  function commitRenameBookmark(bookmarkId: string) {
    const nextTitle = renameValue.trim();
    if (nextTitle.length > 0) {
      onRenameBookmark?.(bookmarkId, nextTitle);
    }
    setRenamingBookmarkId(null);
  }

  function renderFrameStrip(frameStrip: string[], clip: TimelineClipModel) {
    const fallbackUrl = clip.metadata?.frameStripSource?.fallbackUrl;

    return (
      <div className="absolute inset-0 flex overflow-hidden rounded-md">
        {frameStrip.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            className="relative h-full flex-1 overflow-hidden border-r last:border-r-0 transition-opacity hover:opacity-100"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
            onClick={(event) => {
              if (shouldSuppressClick()) {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              event.stopPropagation();

              if (isBookmarkTrack) {
                const bookmarkId = clip.metadata?.bookmarkId;
                if (bookmarkId) {
                  onSelectBookmark?.(bookmarkId);
                }
                return;
              }

              const local = frameStrip.length <= 1 ? 0 : index / (frameStrip.length - 1);
              onPlayheadChange(clampProgress(clip.start + local * (clip.end - clip.start)));
            }}
          >
            <TimelineStripImage url={url} fallbackUrl={fallbackUrl} />
          </button>
        ))}
      </div>
    );
  }

  function renderBookmarkBackgroundStrip(clip: TimelineClipModel, clipWidth: number) {
    const videoUrl = clip.metadata?.backgroundMediaUrl;
    if (!videoUrl || !isBookmarkTrack) {
      return null;
    }

    const sampleCount = Math.max(4, Math.min(8, Math.round(clipWidth / 52)));
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
        <TimelineVideoStrip
          url={videoUrl}
          posterUrl={clip.metadata?.backgroundMediaPosterUrl}
          durationMs={clip.metadata?.backgroundMediaDurationMs}
          sampleCount={sampleCount}
        />
      </div>
    );
  }

  function renderClipMenuContent(clip: TimelineClipModel) {
    if (isBookmarkTrack) {
      const bookmarkId = clip.metadata?.bookmarkId;
      const canDeleteBookmark = resolvedTrack.clips.length > 1;
      if (!bookmarkId) {
        return null;
      }

      return (
        <>
          <DropdownMenuItem onClick={() => startRenameBookmark(clip)}>
            <Pencil className="h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canDeleteBookmark}
            variant="destructive"
            onClick={() => onDeleteBookmark?.(bookmarkId)}
          >
            <Trash2 className="h-4 w-4" />
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
                {clip.metadata?.enterAnimationType === item.type ? (
                  <Check className="h-3.5 w-3.5 text-[var(--editor-accent)]" />
                ) : (
                  <span className="w-3.5" />
                )}
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
                {clip.metadata?.exitAnimationType === item.type ? (
                  <Check className="h-3.5 w-3.5 text-[var(--editor-accent)]" />
                ) : (
                  <span className="w-3.5" />
                )}
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
          .filter((layerTrack) => layerTrack.id !== resolvedTrack.id)
          .map((layerTrack) => (
            <DropdownMenuItem
              key={`${clip.id}-${layerTrack.id}`}
              onClick={() => {
                if (typeof layerTrack.metadata?.layerIndex === "number") {
                  onMoveClipToLayer(clip.id, layerTrack.metadata.layerIndex);
                }
              }}
            >
              Move to {layerTrack.label}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDuplicateClip(clip.id)}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDeleteClip(clip.id)}>Delete</DropdownMenuItem>
      </>
    );
  }

  function renderClipMenuTrigger(clip: TimelineClipModel, isVisible: boolean) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Open clip actions"
            aria-label="Open clip actions"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgba(10,10,12,0.45)] text-[var(--editor-text-dim)] opacity-100 transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
            style={{ opacity: isVisible ? 1 : 0.88 }}
            onClick={(event) => event.stopPropagation()}
          >
            <Ellipsis className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {renderClipMenuContent(clip)}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderBookmarkAddBlock() {
    if (!isBookmarkTrack || !onAddBookmark) {
      return null;
    }

    const addStart =
      resolvedTrack.metadata?.bookmarkAddStart ?? Math.min(resolvedTrack.clips.at(-1)?.end ?? 0.72, 0.88);
    const addEnd = resolvedTrack.metadata?.bookmarkAddEnd ?? 1;
    const left = TIMELINE_START_OFFSET + addStart * totalW;
    const width = Math.max(124, (addEnd - addStart) * totalW);
    const lastBookmarkId = resolvedTrack.clips.at(-1)?.metadata?.bookmarkId;

    return (
      <div
        className="absolute top-2 h-10"
        style={{ left, width }}
        onDragOver={(event) => {
          if (!draggedBookmarkId || !lastBookmarkId || !onReorderBookmarks) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!draggedBookmarkId || !lastBookmarkId || !onReorderBookmarks || draggedBookmarkId === lastBookmarkId) return;
          onReorderBookmarks(draggedBookmarkId, lastBookmarkId);
          setDraggedBookmarkId(null);
        }}
      >
        <button
          type="button"
          className="flex h-full w-full items-center justify-center gap-2 rounded-md border border-dashed text-xs font-medium transition-colors hover:bg-[rgba(205,239,255,0.06)]"
          style={{
            borderColor: "rgba(205,239,255,0.18)",
            background: "rgba(255,255,255,0.02)",
            color: "var(--editor-text-dim)",
          }}
          onClick={onAddBookmark}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Bookmark
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative h-14"
      style={{ width: totalW + TIMELINE_START_OFFSET + (isBookmarkTrack ? TIMELINE_ADD_BLOCK_PX : 0) }}
    >
      {resolvedTrack.clips.map((clip) => {
        const previewTiming = clipTimingPreview?.clipId === clip.id ? clipTimingPreview : null;
        const clipStart = previewTiming?.start ?? clip.start;
        const clipEnd = previewTiming?.end ?? clip.end;
        const left = TIMELINE_START_OFFSET + clipStart * totalW;
        const width = Math.max(14, (clipEnd - clipStart) * totalW);
        const isSelected = selection?.clipId === clip.id;
        const isMultiSelected = selectedClipIds.includes(clip.id);
        const isSelectionVisible =
          isSelected ||
          isMultiSelected ||
          (!isPlaying && Boolean(clip.metadata?.isSelectedBookmark));
        const frameStrip = showFrameStrip ? frameStripCache.get(clip.id) : undefined;
        const shouldRenderVideoStrip = isBookmarkTrack && !frameStrip && Boolean(clip.metadata?.backgroundMediaUrl);
        const isMoveDragging = draggingClipId === clip.id && draggingClipMode === "move";
        const clipStackIndex = resolvedTrack.clips.findIndex((entry) => entry.id === clip.id);
        const stackZIndex = isBookmarkTrack ? 2 : isMoveDragging ? 40 : isSelected ? 30 : 10 + clipStackIndex;
        const bookmarkId = clip.metadata?.bookmarkId;
        const bookmarkIndex = clip.metadata?.bookmarkIndex ?? clipStackIndex;
        const isRenaming = bookmarkId != null && renamingBookmarkId === bookmarkId;
        const canDragBookmark = false;
        const canResizeClip = Boolean(!isBookmarkTrack && draggable);
        const canMoveClip = draggable && !isBookmarkTrack;

        return (
          <Fragment key={clip.id}>
            <div
              tabIndex={0}
              draggable={canDragBookmark}
              className="motionroll-clip group absolute top-2 h-10 select-none rounded-md border transition-[background,border-color,box-shadow,transform,opacity] duration-150 hover:-translate-y-[1px] hover:border-[rgba(255,255,255,0.14)]"
              style={{
                left,
                width,
                zIndex: stackZIndex,
                background: frameStrip
                  ? "#0c1118"
                  : shouldRenderVideoStrip
                    ? "#0c1118"
                  : clip.metadata?.isGroup
                    ? isSelectionVisible
                      ? "rgba(103,232,249,0.16)"
                      : "rgba(205,239,255,0.08)"
                    : isBookmarkTrack
                      ? isSelectionVisible
                        ? "rgba(205,239,255,0.12)"
                        : "rgba(255,255,255,0.04)"
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
              onClick={(event) => {
                if (shouldSuppressClick()) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                event.stopPropagation();

                if (isBookmarkTrack) {
                  if (bookmarkId) {
                    onSelectBookmark?.(bookmarkId);
                  }
                  return;
                }

                const rect = event.currentTarget.getBoundingClientRect();
                const local = clampProgress((event.clientX - rect.left) / Math.max(rect.width, 1));
                onPlayheadChange(clampProgress(clip.start + local * (clip.end - clip.start)));
              }}
              onMouseDown={canMoveClip ? (event) => beginClipDrag(event, "move", clip, layerTrackIndex) : undefined}
              onDragStart={(event) => {
                if (!canDragBookmark || !bookmarkId) return;
                setDraggedBookmarkId(bookmarkId);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", bookmarkId);
              }}
              onDragOver={(event) => {
                if (!canDragBookmark || !draggedBookmarkId || !bookmarkId || draggedBookmarkId === bookmarkId || !onReorderBookmarks) {
                  return;
                }
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (!draggedBookmarkId || !bookmarkId || draggedBookmarkId === bookmarkId || !onReorderBookmarks) {
                  return;
                }
                event.preventDefault();
                onReorderBookmarks(draggedBookmarkId, bookmarkId);
                setDraggedBookmarkId(null);
              }}
              onDragEnd={() => setDraggedBookmarkId(null)}
            >
              {frameStrip ? renderFrameStrip(frameStrip, clip) : null}
              {!frameStrip ? renderBookmarkBackgroundStrip(clip, width) : null}

              {isBookmarkTrack ? (
                <div
                  className="pointer-events-none absolute inset-0 rounded-md"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(8,10,14,0.12) 0%, rgba(8,10,14,0.36) 58%, rgba(8,10,14,0.68) 100%)",
                  }}
                />
              ) : null}

              <div className="relative z-[1] h-full px-2">
                {isBookmarkTrack ? (
                  <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[rgba(255,255,255,0.62)]">
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em]">
                      {String(bookmarkIndex + 1).padStart(2, "0")}
                    </span>
                  </div>
                ) : (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2">
                    {renderClipMenuTrigger(clip, isSelectionVisible)}
                  </div>
                )}

                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  {renderClipMenuTrigger(clip, isSelectionVisible)}
                </div>

                <div className={`flex h-full min-w-0 flex-col justify-center ${isBookmarkTrack ? "px-11" : "px-8"}`}>
                  {isRenaming && bookmarkId ? (
                    <Input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.currentTarget.value)}
                      onBlur={() => commitRenameBookmark(bookmarkId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRenameBookmark(bookmarkId);
                        if (event.key === "Escape") setRenamingBookmarkId(null);
                      }}
                      autoFocus
                      className="h-7 min-w-0 border-0 bg-transparent px-0 text-xs text-white shadow-none focus-visible:ring-0"
                      aria-label={`Rename ${clip.label}`}
                    />
                  ) : (
                    <>
                      <div className="flex min-w-0 items-center gap-1.5">
                        {clip.metadata?.isGroup ? (
                          <span
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                            style={{ background: "rgba(205,239,255,0.08)", color: "var(--editor-accent)" }}
                          >
                            <Layers3 className="h-3 w-3" />
                          </span>
                        ) : null}
                        <span className="block truncate text-xs font-medium text-white">{clip.label ?? clip.id}</span>
                      </div>
                      {isBookmarkTrack ? (
                        <span
                          className="block truncate text-[10px] uppercase tracking-[0.08em]"
                          style={{ color: "rgba(255,255,255,0.62)" }}
                        >
                          Start {Math.round(clip.start * 100)}%
                        </span>
                      ) : clip.metadata?.isGroup ? (
                        <span
                          className="block truncate text-[10px] uppercase tracking-[0.08em]"
                          style={{ color: "rgba(255,255,255,0.56)" }}
                        >
                          {clip.metadata.childCount ?? 0} items
                        </span>
                      ) : !frameStrip && clip.metadata?.contentType ? (
                        <span
                          className="block truncate text-[10px] uppercase tracking-[0.08em]"
                          style={{ color: "rgba(255,255,255,0.56)" }}
                        >
                          {clip.metadata.contentType}
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {canResizeClip ? (
                <>
                  <div
                    className="timeline-resize-handle absolute inset-y-0 left-0 z-[2] w-2 rounded-l-md cursor-ew-resize"
                    style={{ background: "rgba(191,227,255,0.55)", opacity: isSelectionVisible ? 0.95 : 0.6 }}
                    onMouseDown={(event) => beginClipDrag(event, "resize-start", clip, layerTrackIndex)}
                  />
                  <div
                    className="timeline-resize-handle absolute inset-y-0 right-0 z-[2] w-2 rounded-r-md cursor-ew-resize"
                    style={{ background: "rgba(191,227,255,0.55)", opacity: isSelectionVisible ? 0.95 : 0.6 }}
                    onMouseDown={(event) => beginClipDrag(event, "resize-end", clip, layerTrackIndex)}
                  />
                </>
              ) : null}
            </div>
          </Fragment>
        );
      })}
      {renderBookmarkAddBlock()}
    </div>
  );
}

export const TimelineTrackRow = React.memo(TimelineTrackRowInner, (prev, next) => {
  return (
    prev.track === next.track &&
    prev.totalW === next.totalW &&
    prev.tint === next.tint &&
    prev.showFrameStrip === next.showFrameStrip &&
    prev.draggable === next.draggable &&
    prev.isPlaying === next.isPlaying &&
    prev.layerTrackIndex === next.layerTrackIndex &&
    prev.selection === next.selection &&
    prev.selectedClipIds === next.selectedClipIds &&
    prev.draggingClipId === next.draggingClipId &&
    prev.draggingClipMode === next.draggingClipMode &&
    prev.clipTimingPreview === next.clipTimingPreview &&
    prev.frameStripCache === next.frameStripCache &&
    prev.canGroupSelection === next.canGroupSelection &&
    prev.layerTracks === next.layerTracks
  );
});
TimelineTrackRow.displayName = "TimelineTrackRow";
