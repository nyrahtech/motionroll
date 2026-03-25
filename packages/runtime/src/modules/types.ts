/**
 * types.ts — shared type contracts for the MotionRoll runtime.
 */

export interface CreateScrollSectionOptions {
  mode?: "desktop" | "mobile";
  reducedMotion?: boolean;
  canvas?: HTMLCanvasElement;
  overlayRoot?: HTMLElement;
  interactionMode?: "scroll" | "controlled";
  allowWheelScrub?: boolean;
  enableOverlayTransitions?: boolean;
  onProgressChange?: (progress: number) => void;
  scrollDistance?: number;
  forceSequence?: boolean;
  initialProgress?: number;
}

export interface RenderFallbackResult {
  cleanup: () => void;
  video?: HTMLVideoElement;
  element?: HTMLElement;
}

export interface ScrollSectionController {
  destroy(): void;
  refresh(): void;
  setProgress(progress: number): void;
  setTargetProgress(progress: number): void;
  setOverlayTransitionsEnabled(enabled: boolean): void;
  updateManifest(manifest: import("../../../shared/src/index").ProjectManifest): void;
  getProgress(): number;
  getTargetProgress(): number;
}
