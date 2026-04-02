"use client";

import React from "react";
import {
  Film,
  ImagePlus,
  Type,
} from "lucide-react";
import type {
  BackgroundMedia,
  BackgroundVideoEndBehavior,
  OverlayDefinition,
} from "@motionroll/shared";
import { UploadPanel } from "./upload-panel";

export type SidebarContext = "insert" | "upload" | "edit";

export type SidebarPanelProps = {
  projectId: string;
  activeContext: SidebarContext;
  selectedOverlay?: OverlayDefinition;
  selectedBookmark?: {
    id: string;
    title: string;
    position: number;
  };
  canvasSettings?: {
    title: string;
    frameRangeStart: number;
    frameRangeEnd: number;
    scrollHeightVh: number;
    scrubStrength: number;
    backgroundColor?: string;
    backgroundMedia?: BackgroundMedia;
    backgroundVideoEndBehavior?: BackgroundVideoEndBehavior;
  };
  selectedGroupChildren?: Array<{ id: string; label: string; type: string }>;
  canGroupSelection?: boolean;
  canUngroupSelection?: boolean;
  canSetSelectedOverlayAsBackground?: boolean;
  onContextChange: (context: SidebarContext) => void;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onSelectGroupChild?: (overlayId: string) => void;
  onSetSelectedOverlayAsBackground?: () => void;
  onCancelBackgroundReplacement?: () => void;
  pendingBackgroundReplacement?: boolean;
  onBookmarkFieldChange?: (field: "title" | "position", value: string | number) => void;
  onBookmarkJump?: () => void;
  onDeleteBookmark?: () => void;
  onCanvasFieldChange?: (
    field: "frameRangeStart" | "frameRangeEnd" | "scrollHeightVh" | "scrubStrength" | "backgroundColor",
    value: string | number,
  ) => void;
  onCanvasBackgroundColorChange?: (value: string) => void;
  onCanvasBackgroundEndBehaviorChange?: (value: BackgroundVideoEndBehavior) => void;
  onDetachCanvasBackground?: () => void;
  onRemoveCanvasBackground?: () => void;
  onOverlayFieldChange: (field: string, value: string | number) => void;
  onOverlayStyleChange: (field: string, value: string | number | boolean) => void;
  onOverlayStyleLiveChange?: (field: string, value: string | number) => void;
  onOverlayStyleLiveCommit?: (field: string, value: string | number) => void;
  onOverlayEnterAnimationChange: (field: string, value: string | number) => void;
  onOverlayExitAnimationChange: (field: string, value: string | number) => void;
  onAddContent: (type: string) => void;
  onUploadQueued?: () => void | Promise<void>;
  onVideoInserted?: (payload: {
    usage: "scene_background" | "video_layer";
    asset: {
      id: string;
      publicUrl: string;
      storageKey?: string;
      metadata?: unknown;
    };
  }) => void;
  processingJobs?: Array<{
    id: string;
    status: string;
    failureReason: string | null;
  }>;
};

import { ActionButton, ToolPanel } from "./editor-inspector-primitives";
import { Inspector } from "./editor-inspector";


export function SidebarPanel({
  projectId,
  activeContext,
  selectedOverlay,
  selectedBookmark,
  canvasSettings,
  selectedGroupChildren,
  canGroupSelection = false,
  canUngroupSelection = false,
  canSetSelectedOverlayAsBackground = false,
  onContextChange,
  onGroupSelection,
  onUngroupSelection,
  onSelectGroupChild,
  onSetSelectedOverlayAsBackground,
  onCancelBackgroundReplacement,
  pendingBackgroundReplacement = false,
  onBookmarkFieldChange,
  onBookmarkJump,
  onDeleteBookmark,
  onCanvasFieldChange,
  onCanvasBackgroundColorChange,
  onCanvasBackgroundEndBehaviorChange,
  onDetachCanvasBackground,
  onRemoveCanvasBackground,
  onOverlayFieldChange,
  onOverlayStyleChange,
  onOverlayStyleLiveChange,
  onOverlayStyleLiveCommit,
  onOverlayEnterAnimationChange,
  onOverlayExitAnimationChange,
  onAddContent,
  onUploadQueued,
  onVideoInserted,
  processingJobs,
}: SidebarPanelProps) {
  const showUploadTool = activeContext === "upload";
  const showStructureInspector =
    activeContext !== "upload" && !selectedOverlay && (Boolean(selectedBookmark) || Boolean(canvasSettings));
  const showInspector = activeContext === "edit" || showStructureInspector;
  const showGroupAction = canGroupSelection && activeContext === "edit";

  return (
    <aside
      className="flex h-full w-[360px] shrink-0 flex-col border-r"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton
              icon={<Type className="h-4 w-4" />}
              label="Add Text"
              onClick={() => onAddContent("text")}
            />
            <ActionButton
              icon={<ImagePlus className="h-4 w-4" />}
              label="Add Image"
              onClick={() => onAddContent("image")}
            />
            <ActionButton
              icon={<Film className="h-4 w-4" />}
              label="Add Video"
              active={showUploadTool}
              onClick={() => onContextChange(showUploadTool ? "insert" : "upload")}
            />
          </div>

          {showUploadTool ? (
            <ToolPanel title="Add Video">
              <UploadPanel
                projectId={projectId}
                embedded
                usage="video_layer"
                onUploadQueued={onUploadQueued}
                onVideoInserted={onVideoInserted}
                processingJobs={processingJobs}
              />
            </ToolPanel>
          ) : null}

          {showGroupAction ? (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onGroupSelection}
                className="focus-ring inline-flex h-8 items-center rounded-[10px] border px-2.5 text-xs font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              >
                Group
              </button>
            </div>
          ) : null}

          {showInspector ? (
            <Inspector
              selectedOverlay={selectedOverlay}
              selectedBookmark={selectedBookmark}
              canvasSettings={canvasSettings}
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
              onBookmarkFieldChange={onBookmarkFieldChange}
              onBookmarkJump={onBookmarkJump}
              onDeleteBookmark={onDeleteBookmark}
              onCanvasFieldChange={onCanvasFieldChange}
              onCanvasBackgroundColorChange={onCanvasBackgroundColorChange}
              onCanvasBackgroundEndBehaviorChange={onCanvasBackgroundEndBehaviorChange}
              onDetachCanvasBackground={onDetachCanvasBackground}
              onRemoveCanvasBackground={onRemoveCanvasBackground}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
