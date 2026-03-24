/**
 * overlay-calc.ts — pure overlay calculation functions.
 * No DOM access, no side effects. All inputs/outputs are plain values or
 * read-only data from the manifest.
 */
import { clampProgress } from "../../../shared/src/timing";
import {
  type MotionEasing,
  type OverlayAnimationType,
  type OverlayDefinition,
  type ProjectSectionManifest,
  type ResolvedFallbackStrategy,
  resolveFallbackStrategy,
} from "../../../shared/src/index";
import { clamp } from "../utils";
import type { CreateScrollSectionOptions } from "./types";
import { matchesMediaQuery } from "./reduced-motion";

const DESIGN_STAGE_WIDTH = 1440;
const DESIGN_STAGE_HEIGHT = 810;

export function normalizeRichTextHtml(input: unknown) {
  if (typeof input === "string") {
    return input;
  }

  if (input && typeof input === "object") {
    const legacy = input as {
      eyebrow?: string;
      headline?: string;
      body?: string;
      text?: string;
    };
    return [legacy.text, legacy.eyebrow, legacy.headline, legacy.body]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join("<br><br>");
  }

  return "";
}

export function sanitizeRichTextHtml(input: unknown) {
  const normalized = normalizeRichTextHtml(input);
  if (typeof window === "undefined" || !normalized.trim()) {
    return "";
  }

  const template = document.createElement("template");
  template.innerHTML = normalized;
  const allowedTags = new Set(["A", "EM", "I", "BR"]);

  for (const node of Array.from(template.content.querySelectorAll("*"))) {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent ?? ""));
      continue;
    }

    for (const attribute of Array.from(node.attributes)) {
      if (node.tagName === "A" && attribute.name === "href") {
        const safeHref = getSafeHref(attribute.value);
        if (safeHref) {
          node.setAttribute("href", safeHref);
          node.setAttribute("rel", safeHref.startsWith("http") ? "noreferrer noopener" : "");
          continue;
        }
      }
      node.removeAttribute(attribute.name);
    }
  }

  return template.innerHTML;
}

export function hexToRgbTuple(input: string) {
  const normalized = input.replace("#", "").trim();
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function withOpacity(color: string, opacity: number) {
  const rgb = hexToRgbTuple(color);
  if (!rgb) {
    return color;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

export function getSafeHref(input: string) {
  const trimmed = input.trim();

  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed, typeof window !== "undefined" ? window.location.href : "http://localhost");
    if (["http:", "https:"].includes(url.protocol)) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function choosePlaybackMode(
  section: ProjectSectionManifest,
  options: CreateScrollSectionOptions,
) {
  const reducedMotion =
    options.reducedMotion ?? matchesMediaQuery("(prefers-reduced-motion: reduce)");
  const mode =
    options.mode ?? (matchesMediaQuery("(max-width: 767px)") ? "mobile" : "desktop");
  const interactionMode = options.interactionMode ?? "scroll";
  const durationSeconds = getSectionDurationSeconds(section);
  const visibleFrameCount = Math.max(
    section.progressMapping.frameRange.end - section.progressMapping.frameRange.start + 1,
    1,
  );
  const effectiveSequenceFps = visibleFrameCount / Math.max(durationSeconds, 0.1);

  if (
    interactionMode === "controlled" &&
    !options.forceSequence &&
    section.fallback.fallbackVideoUrl &&
    section.frameAssets.length > 0 &&
    effectiveSequenceFps < 10
  ) {
    return {
      mode,
      fallback: "video" as ResolvedFallbackStrategy,
    };
  }

  if (
    section.frameAssets.length > 0 &&
    (interactionMode === "controlled" || interactionMode === "scroll" || options.forceSequence)
  ) {
    return {
      mode,
      fallback: "sequence" as ResolvedFallbackStrategy,
    };
  }

  const requestedBehavior = reducedMotion
    ? section.fallback.reducedMotionBehavior
    : mode === "mobile"
      ? section.fallback.mobileBehavior
      : "sequence";

  return {
    mode,
    fallback: resolveFallbackStrategy({
      requestedBehavior,
      hasFrames: section.frameAssets.length > 0,
      hasPoster: Boolean(section.fallback.posterUrl),
      hasFallbackVideo: Boolean(section.fallback.fallbackVideoUrl),
      allowFirstFrameFallback: true,
    }),
  };
}

export function getStageScale(stageRoot: HTMLElement) {
  const width = stageRoot.clientWidth || DESIGN_STAGE_WIDTH;
  const height = stageRoot.clientHeight || DESIGN_STAGE_HEIGHT;
  return clamp(Math.min(width / DESIGN_STAGE_WIDTH, height / DESIGN_STAGE_HEIGHT), 0.35, 2);
}

export function getOverlayPixelPlacement(
  overlay: OverlayDefinition,
  stageRoot: HTMLElement,
  stageScale: number,
) {
  const layout = overlay.content.layout;
  const stageWidth = stageRoot.clientWidth || Math.round(DESIGN_STAGE_WIDTH * stageScale);
  const stageHeight = stageRoot.clientHeight || Math.round(DESIGN_STAGE_HEIGHT * stageScale);
  const width = Math.round((layout?.width ?? 420) * stageScale);
  const height = layout?.height ? Math.round(layout.height * stageScale) : undefined;
  const centerAligned = overlay.content.align === "center";
  const anchorLeft = (layout?.x ?? (centerAligned ? 0.5 : 0.08)) * stageWidth;
  const anchorTop = (layout?.y ?? (centerAligned ? 0.5 : 0.12)) * stageHeight;

  return {
    width,
    height,
    anchorLeft,
    anchorTop,
    left: centerAligned ? anchorLeft - width / 2 : anchorLeft,
    top: centerAligned ? anchorTop - (height ?? 0) / 2 : anchorTop,
  };
}

export function getSectionDurationSeconds(section: ProjectSectionManifest) {
  if (
    typeof section.motion.durationSeconds === "number" &&
    Number.isFinite(section.motion.durationSeconds) &&
    section.motion.durationSeconds > 0
  ) {
    return section.motion.durationSeconds;
  }

  const totalFrameCount = Math.max(
    section.progressMapping.frameCount,
    section.frameCount,
    section.progressMapping.frameRange.end + 1,
    0,
  );
  return totalFrameCount > 0 ? totalFrameCount / 24 : 8;
}

export function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

export function formatPx(value: number) {
  if (Math.abs(value) < 0.001) {
    return "0px";
  }
  return `${Number(value.toFixed(3))}px`;
}

export function formatScale(value: number) {
  return Number(value.toFixed(4));
}

export function applyMotionEasing(progress: number, easing: MotionEasing | undefined) {
  const t = clamp(progress, 0, 1);

  if (easing === "linear") {
    return t;
  }

  if (easing === "ease-in-out") {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  }

  if (easing === "back-out") {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * ((t - 1) ** 3) + c1 * ((t - 1) ** 2);
  }

  if (easing === "expo-out") {
    return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
  }

  return 1 - (1 - t) ** 3;
}

export function getBaseOverlayTranslate(overlay: OverlayDefinition) {
  return overlay.content.align === "center"
    ? { x: -50, y: -50, unit: "%" as const }
    : { x: 0, y: 0, unit: "px" as const };
}

function getAnimationType(
  overlay: OverlayDefinition,
  phase: "enter" | "exit",
): OverlayAnimationType {
  const content = overlay.content as OverlayDefinition["content"] & {
    animation?: { preset?: string };
    transition?: { preset?: string };
  };

  if (phase === "enter") {
    if (overlay.content.enterAnimation?.type) {
      return overlay.content.enterAnimation.type;
    }
    switch (content.animation?.preset) {
      case "slide-up":
        return "slide-up-fade";
      case "scale-in":
        return "scale-fade";
      case "fade":
      case "slide-down":
      case "blur-in":
      default:
        return "fade";
    }
  }

  if (overlay.content.exitAnimation?.type) {
    return overlay.content.exitAnimation.type;
  }
  switch (content.transition?.preset) {
    case "zoom-dissolve":
      return "scale-fade";
    case "fade":
    case "crossfade":
    case "wipe":
    case "blur-dissolve":
      return "fade";
    default:
      return "none";
  }
}

function getTransformOffset(
  type: OverlayAnimationType,
  phase: "enter" | "exit",
) {
  if (type === "slide-up-fade") {
    return { x: 0, y: phase === "enter" ? 22 : -22, scale: 1 };
  }
  if (type === "slide-left-fade") {
    return { x: phase === "enter" ? 22 : -22, y: 0, scale: 1 };
  }
  if (type === "scale-fade") {
    return { x: 0, y: 0, scale: 0.94 };
  }
  return { x: 0, y: 0, scale: 1 };
}

function formatTranslateAxis(
  baseValue: number,
  baseUnit: "px" | "%",
  offsetPx: number,
) {
  if (baseUnit === "%") {
    if (Math.abs(offsetPx) < 0.001) {
      return `${baseValue}%`;
    }
    return `calc(${baseValue}% + ${formatPx(offsetPx)})`;
  }

  return formatPx(baseValue + offsetPx);
}

export function getOverlayTransform(
  overlay: OverlayDefinition,
  _entrance: ProjectSectionManifest["runtimeProfile"]["overlayEntrance"],
  enterProgress: number,
  exitProgress = 0,
) {
  const baseTranslate = getBaseOverlayTranslate(overlay);
  const enterType = getAnimationType(overlay, "enter");
  const exitType = getAnimationType(overlay, "exit");
  const enterOffset = getTransformOffset(enterType, "enter");
  const exitOffset = getTransformOffset(exitType, "exit");
  const offsetX = enterOffset.x * (1 - enterProgress) + exitOffset.x * exitProgress;
  const offsetY = enterOffset.y * (1 - enterProgress) + exitOffset.y * exitProgress;
  const enteredScale = mix(enterOffset.scale, 1, enterProgress);
  const finalScale = mix(enteredScale, exitOffset.scale, exitProgress);

  return `translate3d(${formatTranslateAxis(baseTranslate.x, baseTranslate.unit, offsetX)}, ${formatTranslateAxis(baseTranslate.y, baseTranslate.unit, offsetY)}, 0) scale(${formatScale(finalScale)})`;
}

export function getOverlayTransitionStyle(overlay: OverlayDefinition) {
  const enterDurationMs = Math.round((overlay.content.enterAnimation?.duration ?? 0.45) * 1000);
  const exitDurationMs = Math.round((overlay.content.exitAnimation?.duration ?? 0.35) * 1000);
  const durationMs = Math.max(160, Math.min(Math.max(enterDurationMs, exitDurationMs), 280));
  return `opacity ${durationMs}ms ease, transform ${durationMs}ms ease, filter ${durationMs}ms ease`;
}

export function getTimedProgress(
  progress: number,
  start: number,
  delay: number,
  duration: number,
) {
  if (duration <= Number.EPSILON) {
    return progress >= start + delay ? 1 : 0;
  }

  return clamp((progress - (start + delay)) / duration, 0, 1);
}

export function getOverlayAnimationState(
  overlay: OverlayDefinition,
  section: ProjectSectionManifest,
  progress: number,
) {
  const normalized = clampProgress(progress);
  const durationSeconds = getSectionDurationSeconds(section);
  const activeWindow = Math.max(overlay.timing.end - overlay.timing.start, 0.0001);
  const enterDelay = clampProgress((overlay.content.enterAnimation?.delay ?? 0) / durationSeconds);
  const availableEnterWindow = Math.max(activeWindow - enterDelay, 0);
  const enterDuration = Math.min(
    clampProgress((overlay.content.enterAnimation?.duration ?? 0.45) / durationSeconds),
    Math.max(availableEnterWindow, 0.0001),
  );
  const exitDuration = Math.min(
    clampProgress((overlay.content.exitAnimation?.duration ?? 0.35) / durationSeconds),
    Math.max(activeWindow, 0.0001),
  );
  const enterProgress = getTimedProgress(
    normalized,
    overlay.timing.start,
    enterDelay,
    overlay.content.enterAnimation?.type === "none" ? 0 : enterDuration,
  );
  const exitStart = Math.max(overlay.timing.start, overlay.timing.end - exitDuration);
  const exitProgress =
    overlay.content.exitAnimation?.type === "none"
      ? 0
      : getTimedProgress(normalized, exitStart, 0, exitDuration);
  const easedEnterProgress = applyMotionEasing(
    enterProgress,
    overlay.content.enterAnimation?.easing,
  );
  const easedExitProgress = applyMotionEasing(
    exitProgress,
    overlay.content.exitAnimation?.easing,
  );

  const opacity = clamp(
    (overlay.content.style?.opacity ?? 1) *
      clamp(easedEnterProgress, 0, 1) *
      clamp(1 - easedExitProgress, 0, 1),
    0,
    1,
  );
  const active =
    normalized >= overlay.timing.start &&
    normalized < overlay.timing.end + 0.0001 &&
    opacity > 0.001;

  return {
    active,
    opacity,
    transform: getOverlayTransform(
      overlay,
      section.runtimeProfile.overlayEntrance,
      easedEnterProgress,
      easedExitProgress,
    ),
    filter: "blur(0px)",
    clipPath: "inset(0% 0% 0% 0%)",
  };
}
