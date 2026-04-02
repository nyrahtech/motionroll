"use client";

import React from "react";
import { GripVertical } from "lucide-react";
import { TimelineLayerLabel } from "./timeline/TimelineLayerLabel";
import { TimelinePlayhead } from "./timeline/TimelinePlayhead";
import { TimelineRuler } from "./timeline/TimelineRuler";
import { TimelineScrollArea } from "./timeline/TimelineScrollArea";
import { TimelineTrackRow } from "./timeline/TimelineTrackRow";
import { useTimelinePanelState } from "./hooks/useTimelinePanelState";
import { TIMELINE_START_OFFSET } from "./timeline-layout";
import { TimelinePlaybackStrip } from "./timeline-playback-strip";
import type { TimelinePanelProps } from "./timeline-panel.types";
import { LABEL_W } from "./timeline-panel-utils";

export function TimelinePanel(props: TimelinePanelProps) {
  const {
    tracks,
    selection,
    selectedClipIds,
    playback,
    durationSeconds,
    isPlaying,
    canUndo,
    canRedo,
    canGroupSelection,
    canUngroupSelection,
    onPlayToggle,
    onUndo,
    onRedo,
    onGroupSelection,
    onUngroupSelection,
    onPlayheadChange,
    onDuplicateClip,
    onDeleteClip,
    onMoveClipToLayer,
    onMoveClipToNewLayer,
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
    onAddLayer,
  } = props;

  const {
    scrollRef,
    trackAreaRef,
    rowRefs,
    bookmarkTrack,
    layerTracks,
    totalW,
    totalTrackW,
    frameStripCache,
    draggedClip,
    draggingClipId,
    draggingClipMode,
    draggingTrackIndex,
    dragGhost,
    clipGhost,
    clipTimingPreview,
    layerRowDescriptors,
    shouldSuppressClick,
    beginClipDrag,
    beginTrackReorder,
    handlePlayheadPointerDown,
    handleDeleteLayerWithAnimation,
  } = useTimelinePanelState(props);

  const layerLabelRows = React.useMemo(
    () => layerRowDescriptors.map((descriptor) => (
      <div
        key={descriptor.track.id}
        className="relative border-b transition-[background,transform,opacity,box-shadow]"
        style={{
          borderColor: "var(--editor-border)",
          opacity: descriptor.isDeleting
            ? 0
            : (descriptor.isLayerReorderDrag &&
                draggingTrackIndex != null &&
                !descriptor.isDraggingRow)
              ? 0.94
              : 1,
          animation: descriptor.isDeleting
            ? "timeline-layer-removing 140ms ease forwards"
            : descriptor.isRecentlyAdded
              ? "timeline-layer-added 220ms ease"
              : undefined,
          pointerEvents: descriptor.isDeleting ? "none" : undefined,
          overflow: descriptor.isDeleting ? "hidden" : undefined,
        }}
      >
        {descriptor.showInsertionCue ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[12] h-0.5"
            style={{ background: "var(--editor-accent)", boxShadow: "0 0 10px rgba(103,232,249,0.45)" }}
          />
        ) : null}
        <TimelineLayerLabel
          track={descriptor.track}
          originalIndex={descriptor.originalIndex}
          labelW={LABEL_W}
          isDraggingRow={descriptor.isDraggingRow}
          isLayerReorderDrag={descriptor.isLayerReorderDrag}
          isDropTarget={descriptor.isDropTarget}
          showInsertionCue={descriptor.showInsertionCue}
          movePreviewForTrack={descriptor.movePreviewForTrack}
          previewTimeLabel={descriptor.previewTimeLabel}
          draggedClipLabel={draggedClip?.label}
          beginTrackReorder={beginTrackReorder}
          onDeleteLayer={(idx) => handleDeleteLayerWithAnimation(descriptor.track.id, idx)}
        />
      </div>
    )),
    [beginTrackReorder, draggedClip?.label, draggingTrackIndex, handleDeleteLayerWithAnimation, layerRowDescriptors],
  );

  const layerRows = React.useMemo(
    () => layerRowDescriptors.map((descriptor) => {
      const {
        track,
        originalIndex,
        isDropTarget,
        isDraggingRow,
        isLayerReorderDrag,
        isDeleting,
        movePreviewForTrack,
        previewLeft,
        previewWidth,
        previewTimeLabel,
        showInsertionCue,
        showDropZone,
      } = descriptor;

      return (
        <div
          key={track.id}
          ref={(node) => { rowRefs.current[`layer-${originalIndex}`] = node; }}
          className="relative border-b transition-[background,transform,opacity,box-shadow]"
          style={{
            borderColor: "var(--editor-border)",
            background:
              isLayerReorderDrag
                ? showDropZone
                  ? "rgba(103,232,249,0.09)"
                  : isDropTarget
                    ? "rgba(103,232,249,0.05)"
                    : "transparent"
                : "transparent",
            opacity: isDeleting ? 0 : (isLayerReorderDrag && draggingTrackIndex != null && !isDraggingRow) ? 0.94 : 1,
            transform: isLayerReorderDrag && isDraggingRow ? "translateX(4px)" : undefined,
            boxShadow: isLayerReorderDrag && isDraggingRow
              ? "inset 0 0 0 1px rgba(103,232,249,0.35), 0 10px 24px rgba(0,0,0,0.18)"
              : showDropZone
                ? "inset 0 0 0 1px rgba(103,232,249,0.24)"
                : undefined,
            animation: isDeleting
              ? "timeline-layer-removing 140ms ease forwards"
              : descriptor.isRecentlyAdded
                ? "timeline-layer-added 220ms ease"
                : undefined,
            pointerEvents: isDeleting ? "none" : undefined,
            overflow: isDeleting ? "hidden" : undefined,
          }}
        >
          {showDropZone ? (
            <div
              className="pointer-events-none absolute inset-x-2 inset-y-1 z-[10] rounded-lg border border-dashed"
              style={{
                borderColor: "rgba(103,232,249,0.5)",
                background: "linear-gradient(90deg, rgba(103,232,249,0.12) 0%, rgba(103,232,249,0.04) 100%)",
                boxShadow: "inset 0 0 0 1px rgba(103,232,249,0.12), 0 0 18px rgba(103,232,249,0.08)",
              }}
            >
              <div
                className="absolute inset-y-2 left-0 w-1 rounded-full"
                style={{ background: "var(--editor-accent)", boxShadow: "0 0 12px rgba(103,232,249,0.45)" }}
              />
            </div>
          ) : null}
          {showInsertionCue ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-[12] h-0.5"
              style={{ background: "var(--editor-accent)", boxShadow: "0 0 10px rgba(103,232,249,0.45)" }}
            />
          ) : null}
          {movePreviewForTrack ? (
            <div className="pointer-events-none absolute inset-0 z-[11] p-2">
              <div
                className="absolute top-2 h-10 overflow-hidden rounded-md border border-dashed"
                style={{
                  left: previewLeft,
                  width: previewWidth,
                  borderColor: "rgba(103,232,249,0.58)",
                  background: "rgba(103,232,249,0.08)",
                  boxShadow: "inset 0 0 0 1px rgba(103,232,249,0.18), 0 0 18px rgba(103,232,249,0.12)",
                }}
              >
                <div
                  className="absolute inset-y-1 left-0 w-px"
                  style={{ background: "rgba(103,232,249,0.72)", boxShadow: "0 0 10px rgba(103,232,249,0.3)" }}
                />
                <div
                  className="absolute inset-y-1 right-0 w-px"
                  style={{ background: "rgba(103,232,249,0.72)", boxShadow: "0 0 10px rgba(103,232,249,0.3)" }}
                />
                <div className="flex h-full items-center justify-between gap-2 px-2">
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-[var(--editor-accent)]">
                      {draggedClip?.label ?? movePreviewForTrack.draggedClipId}
                    </span>
                    <span className="block truncate text-[10px] uppercase tracking-[0.1em]" style={{ color: "rgba(103,232,249,0.78)" }}>
                      {movePreviewForTrack.isCrossLayerMove ? `Move to ${track.label}` : `Drop at ${previewTimeLabel}`}
                    </span>
                  </div>
                  {movePreviewForTrack.isSnapped ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]"
                      style={{ background: "rgba(103,232,249,0.14)", color: "var(--editor-accent)" }}
                    >
                      Snapped
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          <TimelineTrackRow
            track={track}
            totalW={totalW}
            tint="rgba(255,255,255,0.06)"
            layerTrackIndex={originalIndex}
            isPlaying={isPlaying}
            selection={selection}
            selectedClipIds={selectedClipIds}
            draggingClipId={draggingClipId}
            draggingClipMode={draggingClipMode}
            clipTimingPreview={clipTimingPreview}
            frameStripCache={frameStripCache}
            canGroupSelection={canGroupSelection}
            layerTracks={layerTracks}
            onPlayheadChange={onPlayheadChange}
            onGroupSelection={onGroupSelection}
            onUngroupSelection={onUngroupSelection}
            onMoveClipToNewLayer={onMoveClipToNewLayer}
            onMoveClipToLayer={onMoveClipToLayer}
            onDuplicateClip={onDuplicateClip}
            onDeleteClip={onDeleteClip}
            onSelectBookmark={onSelectBookmark}
            onRenameBookmark={onRenameBookmark}
            onDuplicateBookmark={onDuplicateBookmark}
            onDeleteBookmark={onDeleteBookmark}
            onAddBookmark={onAddBookmark}
            onAddBookmarkAfter={onAddBookmarkAfter}
            onReorderBookmarks={onReorderBookmarks}
            onSetClipEnterAnimationType={onSetClipEnterAnimationType}
            onSetClipExitAnimationType={onSetClipExitAnimationType}
            onSetBookmarkEnterTransitionPreset={onSetBookmarkEnterTransitionPreset}
            onSetBookmarkExitTransitionPreset={onSetBookmarkExitTransitionPreset}
            shouldSuppressClick={shouldSuppressClick}
            beginClipDrag={beginClipDrag}
          />
        </div>
      );
    }),
    [
      beginClipDrag,
      canGroupSelection,
      clipTimingPreview,
      draggedClip?.label,
      draggingClipId,
      draggingClipMode,
      draggingTrackIndex,
      frameStripCache,
      handleDeleteLayerWithAnimation,
      isPlaying,
      layerRowDescriptors,
      layerTracks,
      onAddBookmark,
      onAddBookmarkAfter,
      onDeleteBookmark,
      onDeleteClip,
      onDuplicateBookmark,
      onDuplicateClip,
      onGroupSelection,
      onMoveClipToLayer,
      onMoveClipToNewLayer,
      onPlayheadChange,
      onRenameBookmark,
      onReorderBookmarks,
      onSelectBookmark,
      onSetBookmarkEnterTransitionPreset,
      onSetBookmarkExitTransitionPreset,
      onSetClipEnterAnimationType,
      onSetClipExitAnimationType,
      onUngroupSelection,
      rowRefs,
      selection,
      selectedClipIds,
      shouldSuppressClick,
      totalW,
    ],
  );

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--editor-panel)" }}>
      <style>{`
        .timeline-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent}
        .timeline-scroll::-webkit-scrollbar{width:6px;height:6px}
        .timeline-scroll::-webkit-scrollbar-track{background:transparent}
        .timeline-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
        .motionroll-clip:focus-visible{outline:none;box-shadow:0 0 0 1px rgba(103,232,249,.55),0 0 0 3px rgba(103,232,249,.12)}
        @keyframes timeline-layer-added{0%{opacity:0;transform:translateY(8px)}55%{opacity:1;transform:translateY(-1px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes timeline-layer-removing{0%{opacity:1;max-height:56px}100%{opacity:0;max-height:0}}
      `}</style>

      <TimelinePlaybackStrip
        playback={playback}
        duration={durationSeconds}
        isPlaying={isPlaying}
        canUndo={canUndo}
        canRedo={canRedo}
        canGroupSelection={canGroupSelection}
        canUngroupSelection={canUngroupSelection}
        onFrameChange={onPlayheadChange}
        onTogglePlay={onPlayToggle}
        onUndo={onUndo}
        onRedo={onRedo}
        onGroupSelection={onGroupSelection}
        onUngroupSelection={onUngroupSelection}
        onAddLayer={onAddLayer}
      />

      <TimelineScrollArea ref={scrollRef} minWidth={totalTrackW + LABEL_W}>
        <>
          <div className="flex min-h-full">
            <div
              className="sticky left-0 z-[60] flex min-h-full w-[168px] shrink-0 flex-col self-stretch"
              style={{
                background: "var(--editor-panel)",
                borderRight: "1px solid var(--editor-border)",
              }}
            >
              <div
                className="flex h-8 items-center border-b px-3"
                style={{
                  background: "var(--editor-panel-elevated)",
                  borderColor: "var(--editor-border)",
                  marginBottom: 1,
                }}
              >
                <span
                  className="truncate text-[10px] font-medium uppercase tracking-[0.12em]"
                  style={{ color: "var(--editor-text-dim)" }}
                >
                  Layers
                </span>
              </div>
              <div
                className="flex h-14 items-center border-b px-4"
                style={{ borderColor: "var(--editor-border)" }}
              >
                <span
                  className="truncate text-xs font-medium tracking-[0.03em]"
                  style={{ color: "var(--editor-text)" }}
                >
                  {bookmarkTrack?.label ?? "Bookmarks"}
                </span>
              </div>
              {layerLabelRows}
              <div className="min-h-0 flex-1" />
            </div>

            <div className="relative min-w-0 flex-1" style={{ width: totalTrackW }}>
              <TimelineRuler
                totalW={totalW}
                durationSeconds={durationSeconds}
                labelW={LABEL_W}
                playback={playback}
                onPlayheadPointerDown={handlePlayheadPointerDown}
                trackAreaRef={trackAreaRef}
                hideLabelColumn
              />

              <div className="border-b" style={{ borderColor: "var(--editor-border)" }}>
                <TimelineTrackRow
                  track={bookmarkTrack}
                  totalW={totalW}
                  showFrameStrip
                  draggable={false}
                  isPlaying={isPlaying}
                  selection={selection}
                  selectedClipIds={selectedClipIds}
                  draggingClipId={draggingClipId}
                  draggingClipMode={draggingClipMode}
                  clipTimingPreview={clipTimingPreview}
                  frameStripCache={frameStripCache}
                  canGroupSelection={canGroupSelection}
                  layerTracks={layerTracks}
                  onPlayheadChange={onPlayheadChange}
                  onGroupSelection={onGroupSelection}
                  onUngroupSelection={onUngroupSelection}
                  onMoveClipToNewLayer={onMoveClipToNewLayer}
                  onMoveClipToLayer={onMoveClipToLayer}
                  onDuplicateClip={onDuplicateClip}
                  onDeleteClip={onDeleteClip}
                  onSelectBookmark={onSelectBookmark}
                  onRenameBookmark={onRenameBookmark}
                  onDuplicateBookmark={onDuplicateBookmark}
                  onDeleteBookmark={onDeleteBookmark}
                  onAddBookmark={onAddBookmark}
                  onAddBookmarkAfter={onAddBookmarkAfter}
                  onReorderBookmarks={onReorderBookmarks}
                  onSetClipEnterAnimationType={onSetClipEnterAnimationType}
                  onSetClipExitAnimationType={onSetClipExitAnimationType}
                  onSetBookmarkEnterTransitionPreset={onSetBookmarkEnterTransitionPreset}
                  onSetBookmarkExitTransitionPreset={onSetBookmarkExitTransitionPreset}
                  shouldSuppressClick={shouldSuppressClick}
                  beginClipDrag={beginClipDrag}
                />
              </div>

              {layerRows}

              <div className="pointer-events-none absolute inset-0 z-[48] overflow-hidden">
                <TimelinePlayhead playback={playback} totalW={totalW} />
              </div>
            </div>
          </div>
        </>

        {dragGhost ? (
          <div
            className="pointer-events-none absolute z-[28] overflow-hidden rounded-md border"
            style={{
              top: dragGhost.top,
              left: dragGhost.left,
              width: dragGhost.width,
              height: dragGhost.height,
              borderColor: "rgba(103,232,249,0.45)",
              background: "rgba(11,14,20,0.88)",
              boxShadow: "0 16px 34px rgba(0,0,0,0.3), 0 0 0 1px rgba(103,232,249,0.24)",
            }}
          >
            <div className="grid h-full grid-cols-[168px_minmax(0,1fr)]">
              <div
                className="flex items-center gap-2 border-r px-3"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(103,232,249,0.1)" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(103,232,249,0.12)] text-[var(--editor-accent)]">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-[var(--editor-accent)]">{dragGhost.label}</span>
                  <span className="block text-[10px] uppercase tracking-[0.12em] text-[var(--editor-accent)]">Dragging layer</span>
                </div>
              </div>
              <div className="flex items-center px-4">
                <div className="h-10 w-full rounded-md border border-dashed border-[rgba(103,232,249,0.35)] bg-[rgba(255,255,255,0.03)]" />
              </div>
            </div>
          </div>
        ) : null}

        {clipGhost ? (
          <div
            className="pointer-events-none absolute z-[30] overflow-hidden rounded-md border"
            style={{
              top: clipGhost.top,
              left: clipGhost.left,
              width: clipGhost.width,
              height: 40,
              borderColor: "rgba(103,232,249,0.45)",
              background: "rgba(11,14,20,0.9)",
              boxShadow: "0 16px 34px rgba(0,0,0,0.3), 0 0 0 1px rgba(103,232,249,0.24)",
            }}
          >
            <div className="flex h-full items-center justify-between gap-2 px-2">
              <div className="min-w-0">
                <span className="block truncate text-xs font-medium text-white">{clipGhost.label}</span>
                {clipGhost.contentType ? (
                  <span className="block truncate text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.56)" }}>
                    {clipGhost.contentType}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div
          className="pointer-events-auto absolute bottom-0 left-0 z-[70]"
          style={{
            width: LABEL_W,
            background: "var(--editor-panel)",
          }}
        />
      </TimelineScrollArea>
    </div>
  );
}
