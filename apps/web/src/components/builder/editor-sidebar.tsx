"use client";

import React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Film,
  ImagePlus,
  Sparkles,
  Type,
} from "lucide-react";
import type { OverlayDefinition } from "@motionroll/shared";
import { ProviderPanel } from "./provider-panel";
import { UploadPanel } from "./upload-panel";

export type SidebarContext = "insert" | "upload" | "ai" | "edit";

export type SidebarPanelProps = {
  projectId: string;
  activeContext: SidebarContext;
  selectedOverlay?: OverlayDefinition;
  selectedGroupChildren?: Array<{ id: string; label: string; type: string }>;
  canGroupSelection?: boolean;
  canUngroupSelection?: boolean;
  onContextChange: (context: SidebarContext) => void;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onSelectGroupChild?: (overlayId: string) => void;
  onOverlayFieldChange: (field: string, value: string | number) => void;
  onOverlayStyleChange: (field: string, value: string | number | boolean) => void;
  onOverlayStyleLiveChange?: (field: string, value: string | number) => void;
  onOverlayEnterAnimationChange: (field: string, value: string | number) => void;
  onOverlayExitAnimationChange: (field: string, value: string | number) => void;
  onAddContent: (type: string) => void;
  onUploadQueued?: () => void | Promise<void>;
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
  selectedGroupChildren,
  canGroupSelection = false,
  canUngroupSelection = false,
  onContextChange,
  onGroupSelection,
  onUngroupSelection,
  onSelectGroupChild,
  onOverlayFieldChange,
  onOverlayStyleChange,
  onOverlayStyleLiveChange,
  onOverlayEnterAnimationChange,
  onOverlayExitAnimationChange,
  onAddContent,
  onUploadQueued,
  processingJobs,
}: SidebarPanelProps) {
  const showUploadTool = activeContext === "upload";
  const showAiTool = activeContext === "ai";
  const showInspector = activeContext === "edit";
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
              label="Import Video"
              active={showUploadTool}
              onClick={() => onContextChange(showUploadTool ? "insert" : "upload")}
            />
            <ActionButton
              icon={<Sparkles className="h-4 w-4" />}
              label="AI Import"
              active={showAiTool}
              onClick={() => onContextChange(showAiTool ? "insert" : "ai")}
            />
          </div>

          {showUploadTool ? (
            <ToolPanel title="Import Video">
              <UploadPanel
                projectId={projectId}
                embedded
                onUploadQueued={onUploadQueued}
                processingJobs={processingJobs}
              />
            </ToolPanel>
          ) : null}

          {showAiTool ? (
            <ToolPanel title="AI Import">
              <ProviderPanel projectId={projectId} embedded />
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
              onOverlayFieldChange={onOverlayFieldChange}
              onOverlayStyleChange={onOverlayStyleChange}
              onOverlayStyleLiveChange={onOverlayStyleLiveChange}
              onOverlayEnterAnimationChange={onOverlayEnterAnimationChange}
              onOverlayExitAnimationChange={onOverlayExitAnimationChange}
              selectedGroupChildren={selectedGroupChildren}
              canUngroupSelection={canUngroupSelection}
              onUngroupSelection={onUngroupSelection}
              onSelectGroupChild={onSelectGroupChild}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
