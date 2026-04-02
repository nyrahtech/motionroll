"use client";

import React from "react";
import type { SidebarPanelProps } from "./editor-sidebar";
import { EmptyInspector } from "./editor-inspector-primitives";
import { BookmarkInspectorPanel } from "./editor-inspector-panels/bookmark-inspector-panel";
import { CanvasInspectorPanel } from "./editor-inspector-panels/canvas-inspector-panel";
import { LayerInspectorPanel } from "./editor-inspector-panels/layer-inspector-panel";

export function Inspector({
  selectedOverlay,
  selectedBookmark,
  canvasSettings,
  canSetSelectedOverlayAsBackground,
  onOverlayFieldChange,
  onOverlayStyleChange,
  onOverlayStyleLiveChange,
  onOverlayStyleLiveCommit,
  onOverlayEnterAnimationChange,
  onOverlayExitAnimationChange,
  selectedGroupChildren,
  canUngroupSelection,
  onUngroupSelection,
  onSelectGroupChild,
  onSetSelectedOverlayAsBackground,
  onCancelBackgroundReplacement,
  pendingBackgroundReplacement,
  onBookmarkFieldChange,
  onBookmarkJump,
  onDeleteBookmark,
  onCanvasFieldChange,
  onCanvasBackgroundColorChange,
  onCanvasBackgroundEndBehaviorChange,
  onDetachCanvasBackground,
  onRemoveCanvasBackground,
}: Pick<
  SidebarPanelProps,
  | "selectedOverlay"
  | "selectedBookmark"
  | "canvasSettings"
  | "canSetSelectedOverlayAsBackground"
  | "onOverlayFieldChange"
  | "onOverlayStyleChange"
  | "onOverlayStyleLiveChange"
  | "onOverlayStyleLiveCommit"
  | "onOverlayEnterAnimationChange"
  | "onOverlayExitAnimationChange"
  | "selectedGroupChildren"
  | "canUngroupSelection"
  | "onUngroupSelection"
  | "onSelectGroupChild"
  | "onSetSelectedOverlayAsBackground"
  | "onCancelBackgroundReplacement"
  | "pendingBackgroundReplacement"
  | "onBookmarkFieldChange"
  | "onBookmarkJump"
  | "onDeleteBookmark"
  | "onCanvasFieldChange"
  | "onCanvasBackgroundColorChange"
  | "onCanvasBackgroundEndBehaviorChange"
  | "onDetachCanvasBackground"
  | "onRemoveCanvasBackground"
>) {
  if (!selectedOverlay) {
    if (selectedBookmark) {
      return (
        <BookmarkInspectorPanel
          selectedBookmark={selectedBookmark}
          onBookmarkFieldChange={onBookmarkFieldChange}
          onBookmarkJump={onBookmarkJump}
          onDeleteBookmark={onDeleteBookmark}
        />
      );
    }

    if (!canvasSettings) {
      return <EmptyInspector />;
    }

    return (
      <CanvasInspectorPanel
        canvasSettings={canvasSettings}
        onCanvasFieldChange={onCanvasFieldChange}
        onCanvasBackgroundColorChange={onCanvasBackgroundColorChange}
        onCanvasBackgroundEndBehaviorChange={onCanvasBackgroundEndBehaviorChange}
        onDetachCanvasBackground={onDetachCanvasBackground}
        onRemoveCanvasBackground={onRemoveCanvasBackground}
      />
    );
  }

  return (
    <LayerInspectorPanel
      selectedOverlay={selectedOverlay}
      canSetSelectedOverlayAsBackground={canSetSelectedOverlayAsBackground}
      onOverlayFieldChange={onOverlayFieldChange}
      onOverlayStyleChange={onOverlayStyleChange}
      onOverlayStyleLiveChange={onOverlayStyleLiveChange}
      onOverlayStyleLiveCommit={onOverlayStyleLiveCommit}
      onOverlayEnterAnimationChange={onOverlayEnterAnimationChange}
      onOverlayExitAnimationChange={onOverlayExitAnimationChange}
      selectedGroupChildren={selectedGroupChildren}
      canUngroupSelection={canUngroupSelection}
      onUngroupSelection={onUngroupSelection}
      onSelectGroupChild={onSelectGroupChild}
      onSetSelectedOverlayAsBackground={onSetSelectedOverlayAsBackground}
      onCancelBackgroundReplacement={onCancelBackgroundReplacement}
      pendingBackgroundReplacement={pendingBackgroundReplacement}
    />
  );
}
