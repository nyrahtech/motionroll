/**
 * overlay-calc.ts — pure overlay calculation functions.
 * No DOM access, no side effects. All inputs/outputs are plain values or
 * read-only data from the manifest.
 */
import { clampProgress } from "../../../shared/src/timing";
import {
  type MotionEasing,
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

export function getOverlayHiddenOffset(
  overlay: OverlayDefinition,
  entrance: ProjectSectionManifest["runtimeProfile"]["overlayEntrance"],
) {
  const animationPreset = overlay.content.animation?.preset ?? "fade";

  if (overlay.content.align === "center") {
    if (animationPreset === "scale-in") {
      return { x: -50, y: -50, unit: "%" as const, scale: 0.94 };
    }
    return {
      x: -50,
      y: entrance === "crossfade" ? -50 : -50 + 18,
      unit: entrance === "crossfade" ? "%" as const : "calc-percent-plus-px" as const,
      scale: 1,
    };
  }

  if (animationPreset === "slide-up") {
    return { x: 0, y: 22, unit: "px" as const, scale: 1 };
  }
  if (animationPreset === "slide-down") {
    return { x: 0, y: -22, unit: "px" as const, scale: 1 };
  }
  if (animationPreset === "scale-in") {
    return { x: 0, y: 0, unit: "px" as const, scale: 0.94 };
  }
  return {
    x: 0,
    y: entrance === "crossfade" ? 0 : 18,
    unit: "px" as const,
    scale: 1,
  };
}

export function getOverlayTransform(
  overlay: OverlayDefinition,
  entrance: ProjectSectionManifest["runtimeProfile"]["overlayEntrance"],
  introProgress: number,
  outroProgress: number,
) {
  const baseTranslate = getBaseOverlayTranslate(overlay);
  const hidden = getOverlayHiddenOffset(overlay, entrance);
  const introT = applyMotionEasing(introProgress, overlay.content.animation?.easing);
  const exitT = applyMotionEasing(outroProgress, overlay.content.transition?.easing);
  let translateX = baseTranslate.x;
  let translateY = baseTranslate.y;
  let scale = 1;

  if (baseTranslate.unit === "px") {
    translateX += hidden.x * (1 - introT);
    translateY += hidden.y * (1 - introT);
  }

  scale = mix(hidden.scale ?? 1, 1, introT);

  const transitionPreset = overlay.content.transition?.preset ?? "crossfade";
  if (transitionPreset === "zoom-dissolve") {
    scale *= mix(1, 1.04, exitT);
  }

  if (overlay.content.align === "center") {
    if (hidden.unit === "calc-percent-plus-px") {
      const yOffsetPx = 18;
      const nextYOffset = formatPx(yOffsetPx * (1 - introT));
      return `translate3d(-50%, calc(-50% + ${nextYOffset}), 0) scale(${formatScale(scale)})`;
    }

    return `translate3d(-50%, -50%, 0) scale(${formatScale(scale)})`;
  }

  return `translate3d(${formatPx(translateX)}, ${formatPx(translateY)}, 0) scale(${formatScale(scale)})`;
}

export function getOverlayTransitionStyle(overlay: OverlayDefinition) {
  const transition = overlay.content.transition;
  if (!transition) {
    return "";
  }

  if (transition.preset === "wipe") {
    return "clip-path 220ms ease, opacity 220ms ease, transform 220ms ease";
  }

  if (transition.preset === "zoom-dissolve") {
    return "opacity 240ms ease, transform 240ms ease, filter 240ms ease";
  }

  if (transition.preset === "blur-dissolve") {
    return "opacity 220ms ease, filter 220ms ease, transform 220ms ease";
  }

  return "opacity 200ms ease, transform 200ms ease";
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
  const introDelay = clampProgress((overlay.content.animation?.delay ?? 0) / durationSeconds);
  const introDuration = clampProgress((overlay.content.animation?.duration ?? 0.45) / durationSeconds);
  const outroDuration = clampProgress((overlay.content.transition?.duration ?? 0.4) / durationSeconds);
  const introProgress = getTimedProgress(normalized, overlay.timing.start, introDelay, introDuration);
  const outroStart = Math.max(overlay.timing.start, overlay.timing.end - outroDuration);
  const outroProgress = clamp(
    outroDuration <= Number.EPSILON ? (normalized >= overlay.timing.end ? 1 : 0) : (normalized - outroStart) / Math.max(overlay.timing.end - outroStart, Number.EPSILON),
    0,
    1,
  );
  const introOpacity = introProgress;
  let outroOpacity = 1;
  const transitionPreset = overlay.content.transition?.preset ?? "crossfade";
  if (transitionPreset === "fade" || transitionPreset === "crossfade") {
    outroOpacity = 1 - applyMotionEasing(outroProgress, overlay.content.transition?.easing);
  } else if (transitionPreset === "wipe") {
    outroOpacity = mix(1, 0.78, applyMotionEasing(outroProgress, overlay.content.transition?.easing));
  } else {
    outroOpacity = 1 - applyMotionEasing(outroProgress, overlay.content.transition?.easing) * 0.92;
  }

  const opacity = clamp(
    (overlay.content.style?.opacity ?? 1) *
      clamp(introOpacity, 0, 1) *
      clamp(outroOpacity, 0, 1),
    0,
    1,
  );
  const filterBlur =
    mix(
      overlay.content.animation?.preset === "blur-in" ? 10 : 0,
      0,
      applyMotionEasing(introProgress, overlay.content.animation?.easing),
    ) +
    mix(
      0,
      transitionPreset === "blur-dissolve" ? 10 : transitionPreset === "zoom-dissolve" ? 1.5 : 0,
      applyMotionEasing(outroProgress, overlay.content.transition?.easing),
    );
  const clipRightInset =
    transitionPreset === "wipe"
      ? mix(0, 100, applyMotionEasing(outroProgress, overlay.content.transition?.easing))
      : 0;
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
      introProgress,
      outroProgress,
    ),
    filter: filterBlur > 0.05 ? `blur(${Number(filterBlur.toFixed(3))}px)` : "blur(0px)",
    clipPath:
      clipRightInset > 0.05
        ? `inset(0% ${Number(clipRightInset.toFixed(3))}% 0% 0%)`
        : "inset(0% 0% 0% 0%)",
  };
}
