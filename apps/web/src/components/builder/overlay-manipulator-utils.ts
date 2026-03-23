/**
 * overlay-manipulator-utils.ts — pure geometry helpers for OverlayManipulator.
 * No React, no side effects.
 */
import { clampProgress } from "@motionroll/shared";
import type { OverlayDefinition } from "@motionroll/shared";

const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 810;
const MIN_DIM = 80;
const HANDLE_HALF = 6;
const DRAG_HANDLE_OFFSET = 8;
const DRAG_HANDLE_SIZE = 32;

export const MIN_BOX_DIMENSION = MIN_DIM;
export const CORNER_HANDLE_HALF = HANDLE_HALF;
export { DRAG_HANDLE_OFFSET, DRAG_HANDLE_SIZE };

export type Box = { left: number; top: number; width: number; height: number };
export type Corner = "nw" | "ne" | "sw" | "se";
export type LiveResizeTargets = {
  text: HTMLElement | null;
  media: HTMLElement | null;
  actionLink: HTMLElement | null;
  isButtonLike: boolean;
};


export function getStageScale(container: HTMLElement): number {
  return Math.max(
    0.35,
    Math.min(
      container.clientWidth / DESIGN_WIDTH,
      container.clientHeight / DESIGN_HEIGHT,
    ),
  );
}

export function overlayToBox(overlay: OverlayDefinition, container: HTMLElement, renderedHeight: number): Box {
  const layout = overlay.content.layout;
  const cW = container.clientWidth;
  const cH = container.clientHeight;
  const scale = getStageScale(container);
  const w = Math.round((layout?.width ?? 420) * scale);
  const h = renderedHeight;

  if (overlay.content.align === "center") {
    return {
      left: (layout?.x ?? 0.5) * cW - w / 2,
      top:  (layout?.y ?? 0.5) * cH - h / 2,
      width: w,
      height: h,
    };
  }
  return {
    left: (layout?.x ?? 0.08) * cW,
    top:  (layout?.y ?? 0.12) * cH,
    width: w,
    height: h,
  };
}

export function unionBoxes(boxes: Box[]): Box | null {
  if (boxes.length === 0) {
    return null;
  }
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return {
    left,
    top,
    width: Math.max(MIN_DIM, right - left),
    height: Math.max(MIN_DIM, bottom - top),
  };
}

export function boxToLayout(box: Box, overlay: OverlayDefinition, container: HTMLElement) {
  const cW = Math.max(container.clientWidth, 1);
  const cH = Math.max(container.clientHeight, 1);
  const scale = getStageScale(container);
  const center = overlay.content.align === "center";
  return {
    x: clampProgress(center ? (box.left + box.width / 2) / cW : box.left / cW),
    y: clampProgress(center ? (box.top + box.height / 2) / cH : box.top / cH),
    width: Math.round(box.width / scale),
    height: Math.round(box.height / scale),
  };
}

export function toolbarPos(box: Box, cW: number, cH: number) {
  const tbW = 320;
  const tbH = 44;
  const left = Math.max(8, Math.min(box.left, cW - tbW - 8));
  const aboveTop = box.top - tbH - 8;
  const belowTop = box.top + box.height + 8;
  const top = aboveTop >= 8 ? aboveTop : Math.min(belowTop, cH - tbH - 8);
  return { top, left };
}

export function clampScale(value: number, min = 0.5, max = 3) {
  return Math.max(min, Math.min(value, max));
}

export function getResizeStyleChanges(
  overlay: OverlayDefinition,
  initialBox: Box,
  nextBox: Box,
) {
  const baseStyle = overlay.content.style;
  const baseBackground = overlay.content.background;
  const baseLayout = overlay.content.layout;
  const scaleX = initialBox.width > 0 ? nextBox.width / initialBox.width : 1;
  const scaleY = initialBox.height > 0 ? nextBox.height / initialBox.height : 1;
  const areaScale = Math.sqrt(scaleX * scaleY);
  const contentScale = clampScale(1 + (areaScale - 1) * 0.82);
  const paddingScaleX = clampScale(1 + (scaleX - 1) * 0.72);
  const paddingScaleY = clampScale(1 + (scaleY - 1) * 0.72);

  return {
    scaleX,
    scaleY,
    styleChanges: {
      fontSize: Math.max(10, Math.round((baseStyle?.fontSize ?? 34) * contentScale)),
      maxWidth: Math.max(80, Math.round((baseStyle?.maxWidth ?? baseLayout?.width ?? 420) * scaleX)),
    },
    backgroundChanges: {
      radius: Math.max(0, Math.round((baseBackground?.radius ?? 14) * contentScale)),
      paddingX: Math.max(0, Math.round((baseBackground?.paddingX ?? 18) * paddingScaleX)),
      paddingY: Math.max(0, Math.round((baseBackground?.paddingY ?? 14) * paddingScaleY)),
    },
    mediaMaxWidth: Math.max(80, Math.round((baseLayout?.width ?? 420) * scaleX)),
    iconHeight: Math.max(20, Math.round(64 * contentScale)),
    logoHeight: Math.max(24, Math.round(80 * contentScale)),
    actionFontSize: Math.max(10, Math.round(14 * contentScale)),
    actionMarginTop: Math.max(8, Math.round(16 * contentScale)),
    actionPaddingY: Math.max(6, Math.round(9 * paddingScaleY)),
    actionPaddingX: Math.max(8, Math.round(14 * paddingScaleX)),
  };
}

export function getLiveResizeTargets(card: HTMLElement, overlay: OverlayDefinition): LiveResizeTargets {
  return {
    text: card.querySelector<HTMLElement>('[data-text-field="text"]'),
    media: card.querySelector<HTMLElement>("[data-media-field='media']"),
    actionLink: card.querySelector<HTMLElement>("a"),
    isButtonLike: Boolean(overlay.content.style?.buttonLike),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
