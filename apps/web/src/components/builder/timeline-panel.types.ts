"use client";

import type { OverlayAnimationType } from "@motionroll/shared";
import type { EditorPlaybackController } from "./hooks/useEditorPlayback";
import type {
  ClipDragMode,
  ClipGhostState,
  ClipMovePreviewState,
  ClipTimingPreviewState,
  DragGhostState,
} from "./timeline-types";
import type { TimelineTrackModel, TimelineSelection } from "./timeline-model";

export type TimelinePanelProps = {
  tracks: TimelineTrackModel[];
  selection: TimelineSelection;
  selectedClipIds: string[];
  playback: EditorPlaybackController;
  durationSeconds: number;
  isPlaying: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canGroupSelection: boolean;
  canUngroupSelection: boolean;
  onPlayToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  onPlayheadChange: (value: number) => void;
  onSelectionChange: (selection: TimelineSelection, options?: { additive?: boolean }) => void;
  onClipTimingChange: (
    clipId: string,
    timing: { start: number; end: number },
    options?: { dragMode?: "move" | "resize-start" | "resize-end" },
  ) => void;
  onCommitClipMove: (move: { clipId: string; start: number; end: number; targetLayer?: number }) => void;
  onAddLayer: () => void;
  onDeleteLayer: (layerRowIndex: number) => void;
  onAddAtPlayhead: () => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onMoveClipToLayer: (clipId: string, layerIndex: number) => void;
  onMoveClipToNewLayer: (clipId: string) => void;
  onSelectBookmark: (bookmarkId: string) => void;
  onRenameBookmark: (bookmarkId: string, title: string) => void;
  onDuplicateBookmark: (bookmarkId: string) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onAddBookmark: () => void;
  onAddBookmarkAfter: (bookmarkId: string) => void;
  onReorderBookmarks: (fromBookmarkId: string, toBookmarkId: string) => void;
  onSetClipEnterAnimationType: (clipId: string, type: OverlayAnimationType) => void;
  onSetClipExitAnimationType: (clipId: string, type: OverlayAnimationType) => void;
  onSetBookmarkEnterTransitionPreset: (
    bookmarkId: string,
    preset: "none" | "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve",
  ) => void;
  onSetBookmarkExitTransitionPreset: (
    bookmarkId: string,
    preset: "none" | "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve",
  ) => void;
  onReorderTracks: (fromIndex: number, toIndex: number) => void;
};

export type LayerRowDescriptor = {
  track: TimelineTrackModel;
  originalIndex: number;
  isDropTarget: boolean;
  isDraggingRow: boolean;
  isLayerReorderDrag: boolean;
  isBlockMoveDrag: boolean;
  isRecentlyAdded: boolean;
  isDeleting: boolean;
  movePreviewForTrack: ClipMovePreviewState;
  previewLeft: number;
  previewWidth: number;
  previewTimeLabel: string | null;
  showInsertionCue: boolean;
  showDropZone: boolean;
};

export type TimelinePanelState = {
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  trackAreaRef: React.MutableRefObject<HTMLDivElement | null>;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  bookmarkTrack?: TimelineTrackModel;
  layerTracks: TimelineTrackModel[];
  totalW: number;
  totalTrackW: number;
  frameStripCache: Map<string, string[]>;
  draggedClip?: TimelineTrackModel["clips"][number];
  draggingClipId: string | null;
  draggingClipMode: ClipDragMode;
  draggingTrackIndex: number | null;
  dragGhost: DragGhostState;
  clipGhost: ClipGhostState;
  clipTimingPreview: ClipTimingPreviewState;
  layerRowDescriptors: LayerRowDescriptor[];
  shouldSuppressClick: () => boolean;
  beginClipDrag: (
    e: React.MouseEvent,
    type: "move" | "resize-start" | "resize-end",
    clip: TimelineTrackModel["clips"][number],
    layerTrackIndex?: number,
  ) => void;
  beginTrackReorder: (
    event: React.MouseEvent,
    originalIndex: number,
  ) => void;
  handlePlayheadPointerDown: (event: React.PointerEvent) => void;
  handleDeleteLayerWithAnimation: (trackId: string, originalIndex: number) => void;
};
