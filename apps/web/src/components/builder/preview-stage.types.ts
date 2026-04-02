import type { ProjectManifest } from "@motionroll/shared";
import type { EditorPlaybackController } from "./hooks/useEditorPlayback";

export type PreviewStageProps = {
  manifest: ProjectManifest;
  mode: "desktop" | "mobile";
  playback: EditorPlaybackController;
  isPlaying: boolean;
  selectedOverlayId?: string;
  selectedOverlayIds?: string[];
  canGroupSelection?: boolean;
  canUngroupSelection?: boolean;
  onModeChange: (mode: "desktop" | "mobile") => void;
  onPlayheadChange: (value: number) => void;
  onPlayToggle: () => void;
  onSelectOverlay: (overlayId: string, options?: { additive?: boolean }) => void;
  onOverlayLayoutChange: (
    overlayId: string,
    layout: Partial<{ x: number; y: number; width: number; height: number }>,
    options?: {
      intent?: "move" | "resize";
      scaleX?: number;
      scaleY?: number;
      styleChanges?: Record<string, unknown>;
      backgroundChanges?: Record<string, unknown>;
    },
  ) => void;
  onInlineTextChange: (
    overlayId: string,
    field: "text",
    value: string,
    htmlValue?: string,
  ) => void;
  onOverlayStyleLiveChange: (overlayId: string, changes: Record<string, unknown>) => void;
  onOverlayStyleChange: (overlayId: string, changes: Record<string, unknown>) => void;
  onDuplicateOverlay: (overlayId: string) => void;
  onDeleteOverlay: (overlayId: string) => void;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onMoveSelection?: (delta: { x: number; y: number }) => void;
  onDuplicateSelection?: () => void;
  onDeleteSelection?: () => void;
};
