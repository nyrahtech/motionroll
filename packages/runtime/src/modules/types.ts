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

export interface ScrollSectionController {
  destroy(): void;
  refresh(): void;
  setProgress(progress: number): void;
  setTargetProgress(progress: number): void;
  getProgress(): number;
  getTargetProgress(): number;
}
