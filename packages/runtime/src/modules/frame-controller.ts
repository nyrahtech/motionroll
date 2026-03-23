/**
 * frame-controller — manages frame preloading, progress→frame mapping,
 * and canvas rendering. Independently testable.
 */
import {
  type FrameAsset,
  type ProjectSectionManifest,
} from "../../../shared/src/index";
import { clampProgress, frameIndexToSequenceProgress } from "../../../shared/src/timing";
import { progressToFrameIndex, getFrameByIndex } from "../utils";

export type AssetVariantMode = "desktop" | "mobile";

const variantPreferenceMap: Record<AssetVariantMode, string[]> = {
  desktop: ["desktop", "tablet", "mobile", "original"],
  mobile: ["mobile", "tablet", "desktop", "original"],
};

export function chooseFrameUrl(frame: FrameAsset, mode: AssetVariantMode): string {
  for (const kind of variantPreferenceMap[mode]) {
    const variant = frame.variants.find((v) => v.kind === kind && v.url.length > 0);
    if (variant) return variant.url;
  }
  return frame.variants[0]?.url ?? "";
}

export function getFirstFrameUrl(
  section: ProjectSectionManifest,
  mode: AssetVariantMode,
): string {
  return (
    section.fallback.firstFrameUrl ??
    (section.frameAssets[0] ? chooseFrameUrl(section.frameAssets[0], mode) : "")
  );
}

export function getFrameUrlForProgress(
  section: ProjectSectionManifest,
  mode: AssetVariantMode,
  progress: number,
): string {
  if (section.frameAssets.length === 0) return "";
  const frameIndex = progressToFrameIndex(
    getSequenceRangeLocalProgress(section, progress),
    section.progressMapping.frameRange,
  );
  const frame = getFrameByIndex(section.frameAssets, frameIndex);
  return frame ? chooseFrameUrl(frame, mode) : "";
}

export function getSequenceRangeLocalProgress(
  section: ProjectSectionManifest,
  progress: number,
): number {
  const frameCount = Math.max(section.frameCount, 1);
  const rangeStart = frameIndexToSequenceProgress(
    section.progressMapping.frameRange.start,
    frameCount,
  );
  const rangeEnd = frameIndexToSequenceProgress(
    section.progressMapping.frameRange.end,
    frameCount,
  );
  if (rangeEnd <= rangeStart) return rangeStart;
  return clampProgress((progress - rangeStart) / (rangeEnd - rangeStart));
}

export function isSequenceMediaVisibleAtProgress(
  section: ProjectSectionManifest,
  progress: number,
): boolean {
  const frameCount = Math.max(section.frameCount, 1);
  const rangeStart = frameIndexToSequenceProgress(
    section.progressMapping.frameRange.start,
    frameCount,
  );
  const rangeEnd = frameIndexToSequenceProgress(
    section.progressMapping.frameRange.end,
    frameCount,
  );
  const normalized = clampProgress(progress);
  return normalized >= rangeStart && normalized <= rangeEnd + 0.0001;
}

export function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load frame: ${url}`));
    image.src = url;
  });
}

export function renderSequenceFrame(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
): void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = Math.max(1, containerSize(canvas, "width"));
  const cssHeight = Math.max(1, containerSize(canvas, "height"));

  if (
    canvas.width !== Math.round(cssWidth * dpr) ||
    canvas.height !== Math.round(cssHeight * dpr)
  ) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = Math.max(
    cssWidth / image.naturalWidth,
    cssHeight / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (cssWidth - width) / 2;
  const y = (cssHeight - height) / 2;

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.drawImage(image, x, y, width, height);
  canvas.style.opacity = "1";
}

export function renderBlankSequenceFrame(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = Math.max(1, containerSize(canvas, "width"));
  const cssHeight = Math.max(1, containerSize(canvas, "height"));

  if (
    canvas.width !== Math.round(cssWidth * dpr) ||
    canvas.height !== Math.round(cssHeight * dpr)
  ) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  canvas.style.opacity = "1";
}

export function containerSize(
  canvas: HTMLCanvasElement,
  axis: "width" | "height",
): number {
  const rect = canvas.getBoundingClientRect();
  return axis === "width" ? rect.width : rect.height;
}

export function ensureCanvas(
  container: HTMLElement,
  providedCanvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = providedCanvas ?? document.createElement("canvas");
  canvas.width = container.clientWidth || 1440;
  canvas.height = container.clientHeight || 810;
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.zIndex = "1";
  canvas.style.opacity = "0";
  if (!providedCanvas) container.appendChild(canvas);
  return canvas;
}
