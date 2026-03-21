import {
  resolveFallbackStrategy,
  stepSequenceProgress,
  type AssetVariantKind,
  type FrameAsset,
  type OverlayDefinition,
  type MotionEasing,
  type ProjectManifest,
  type ProjectSectionManifest,
  type ResolvedFallbackStrategy,
  type SequenceProgressState,
} from "../../shared/src/index";
import {
  DEFAULT_SEQUENCE_SCROLL_DISTANCE,
  DEFAULT_SEQUENCE_SETTLE_EPSILON,
} from "../../shared/src/sequence";
import { clampProgress, frameIndexToSequenceProgress } from "../../shared/src/timing";
import { clamp, getActiveOverlayId, getFrameByIndex, getOverlaysInStackOrder, progressToFrameIndex } from "./utils";


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

const variantPreferenceMap: Record<"desktop" | "mobile", AssetVariantKind[]> = {
  desktop: ["desktop", "tablet", "mobile", "original"],
  mobile: ["mobile", "tablet", "desktop", "original"],
};
const DESIGN_STAGE_WIDTH = 1440;
const DESIGN_STAGE_HEIGHT = 810;

function chooseSection(manifest: ProjectManifest): ProjectSectionManifest {
  const section = manifest.sections[0];
  if (!section) {
    throw new Error("Manifest must include at least one section.");
  }
  return section;
}

function matchesMediaQuery(query: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(query).matches;
}

function chooseFrameUrl(frame: FrameAsset, mode: "desktop" | "mobile") {
  for (const kind of variantPreferenceMap[mode]) {
    const variant = frame.variants.find((item) => item.kind === kind && item.url.length > 0);
    if (variant) {
      return variant.url;
    }
  }

  return frame.variants[0]?.url ?? "";
}

function getFirstFrameUrl(section: ProjectSectionManifest, mode: "desktop" | "mobile") {
  return (
    section.fallback.firstFrameUrl ??
    (section.frameAssets[0] ? chooseFrameUrl(section.frameAssets[0], mode) : "")
  );
}

function getFrameUrlForProgress(
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  progress: number,
) {
  if (section.frameAssets.length === 0) {
    return "";
  }

  const frameIndex = progressToFrameIndex(
    getSequenceRangeLocalProgress(section, progress),
    section.progressMapping.frameRange,
  );
  const frame = getFrameByIndex(section.frameAssets, frameIndex);
  return frame ? chooseFrameUrl(frame, mode) : "";
}

function getSequenceRangeLocalProgress(
  section: ProjectSectionManifest,
  progress: number,
) {
  const frameCount = Math.max(section.frameCount, 1);
  const rangeStart = frameIndexToSequenceProgress(section.progressMapping.frameRange.start, frameCount);
  const rangeEnd = frameIndexToSequenceProgress(section.progressMapping.frameRange.end, frameCount);
  const normalized = clampProgress(progress);
  const visibleWidth = Math.max(rangeEnd - rangeStart, Number.EPSILON);
  return clampProgress((normalized - rangeStart) / visibleWidth);
}

function appendTextElement(
  parent: HTMLElement,
  tagName: "p" | "h3",
  text: string,
  style: Partial<CSSStyleDeclaration>,
  dataField?: string,
  html?: unknown,
) {
  const element = document.createElement(tagName);
  if (html) {
    element.innerHTML = sanitizeRichTextHtml(html);
  } else {
    element.textContent = text;
  }
  if (dataField) {
    element.dataset.textField = dataField;
  }
  Object.assign(element.style, style);
  parent.appendChild(element);
  return element;
}

function normalizeRichTextHtml(input: unknown) {
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

function sanitizeRichTextHtml(input: unknown) {
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

function hexToRgbTuple(input: string) {
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

function withOpacity(color: string, opacity: number) {
  const rgb = hexToRgbTuple(color);
  if (!rgb) {
    return color;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function getSafeHref(input: string) {
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

function choosePlaybackMode(
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

function getStageScale(stageRoot: HTMLElement) {
  const width = stageRoot.clientWidth || DESIGN_STAGE_WIDTH;
  const height = stageRoot.clientHeight || DESIGN_STAGE_HEIGHT;
  return clamp(Math.min(width / DESIGN_STAGE_WIDTH, height / DESIGN_STAGE_HEIGHT), 0.35, 2);
}

function getOverlayPixelPlacement(
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

function getSectionDurationSeconds(section: ProjectSectionManifest) {
  const totalFrameCount = Math.max(
    section.progressMapping.frameCount,
    section.frameCount,
    section.progressMapping.frameRange.end + 1,
    0,
  );
  return totalFrameCount > 0 ? totalFrameCount / 24 : 8;
}

function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function formatPx(value: number) {
  if (Math.abs(value) < 0.001) {
    return "0px";
  }
  return `${Number(value.toFixed(3))}px`;
}

function formatScale(value: number) {
  return Number(value.toFixed(4));
}

function applyMotionEasing(progress: number, easing: MotionEasing | undefined) {
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

function getBaseOverlayTranslate(overlay: OverlayDefinition) {
  return overlay.content.align === "center"
    ? { x: -50, y: -50, unit: "%" as const }
    : { x: 0, y: 0, unit: "px" as const };
}

function getOverlayHiddenOffset(
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

function getOverlayTransform(
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

function getOverlayTransitionStyle(overlay: OverlayDefinition) {
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

function getTimedProgress(
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

function getOverlayAnimationState(
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

function applyOverlayCardStyles(
  card: HTMLElement,
  overlay: OverlayDefinition,
  stageRoot: HTMLElement,
  mode: "desktop" | "mobile",
  stageScale = 1,
  parentPlacement?: ReturnType<typeof getOverlayPixelPlacement>,
) {
  const layout = overlay.content.layout;
  const style = overlay.content.style;
  const background = overlay.content.background;
  const defaultTop = `${Math.round(32 * stageScale)}px`;
  const defaultLeft = `${Math.round(32 * stageScale)}px`;
  const placement = getOverlayPixelPlacement(overlay, stageRoot, stageScale);
  const localLeft = parentPlacement ? placement.left - parentPlacement.left : placement.left;
  const localTop = parentPlacement ? placement.top - parentPlacement.top : placement.top;
  const localAnchorLeft = parentPlacement
    ? placement.anchorLeft - parentPlacement.left
    : placement.anchorLeft;
  const localAnchorTop = parentPlacement
    ? placement.anchorTop - parentPlacement.top
    : placement.anchorTop;

  card.style.position = "absolute";
  card.style.left =
    overlay.content.align === "center" ? `${Math.round(localAnchorLeft)}px` : `${Math.round(localLeft)}px`;
  card.style.top =
    overlay.content.align === "center" ? `${Math.round(localAnchorTop)}px` : `${Math.round(localTop)}px`;
  card.style.right = "auto";
  card.style.bottom = "auto";
  card.style.width = `${placement.width}px`;
  if (placement.height) {
    const nextHeight = `${placement.height}px`;
    card.style.minHeight = nextHeight;
    card.style.height = nextHeight;
  } else {
    card.style.minHeight = "";
    card.style.height = "";
  }
  card.style.maxWidth =
    overlay.content.type === "group"
      ? `${placement.width}px`
      : `${Math.round((style?.maxWidth ?? layout?.width ?? 420) * stageScale)}px`;
  card.style.padding = `${Math.round(14 * stageScale)}px ${Math.round(18 * stageScale)}px`;
  card.style.borderRadius = ".85rem";
  card.style.backdropFilter = "blur(18px)";
  card.style.cursor = "pointer";
  card.style.userSelect = "none";
  card.style.transform = overlay.content.align === "center" ? "translate3d(-50%, -50%, 0)" : "translate3d(0, 0, 0)";
  card.style.transformOrigin = "center center";
  card.style.opacity = String(style?.opacity ?? 1);
  card.style.background =
    background?.enabled
      ? withOpacity(background.color ?? "#0d1016", background.opacity ?? 0.82)
      : overlay.content.type === "group"
        ? "rgba(205, 239, 255, 0.035)"
        : "transparent";
  card.style.borderColor = withOpacity(
    background?.borderColor ?? "#d6f6ff",
    background?.borderOpacity ?? (overlay.content.type === "group" ? 0.18 : 0),
  );
  card.style.borderWidth = background?.enabled || overlay.content.type === "group" ? "1px" : "0";
  card.style.borderStyle = overlay.content.type === "group" ? "dashed" : "solid";
  card.style.borderRadius = `${background?.radius ?? 14}px`;
  card.style.padding =
    overlay.content.type === "group"
      ? "0px"
      : `${Math.round((background?.paddingY ?? 14) * stageScale)}px ${Math.round((background?.paddingX ?? 18) * stageScale)}px`;
  card.style.backdropFilter =
    background?.enabled ? "blur(18px)" : "none";
  card.style.overflow = overlay.content.type === "group" ? "visible" : "";

  if (!layout) {
    card.style.left = overlay.content.align === "center" ? "50%" : defaultLeft;
    card.style.top = overlay.content.align === "end" ? "auto" : defaultTop;
    card.style.bottom = overlay.content.align === "end" ? defaultTop : "auto";
  }
}

function applyOverlayContentStyles(
  card: HTMLElement,
  overlay: OverlayDefinition,
  stageScale: number,
) {
  if (overlay.content.type === "group") {
    return;
  }

  const textBlock = card.querySelector<HTMLElement>('[data-text-field="text"]');
  const media = card.querySelector<HTMLElement>("[data-media-field='media']");
  const actionLink = card.querySelector<HTMLElement>("a");

  if (textBlock) {
    textBlock.style.fontSize = `${Math.round((overlay.content.style?.fontSize ?? 34) * stageScale)}px`;
  }

  if (media) {
    media.style.maxWidth = `${Math.round((overlay.content.layout?.width ?? 420) * stageScale)}px`;
    if (overlay.content.type === "icon") {
      media.style.height = `${Math.round(64 * stageScale)}px`;
    } else if (overlay.content.type === "logo") {
      media.style.height = `${Math.round(80 * stageScale)}px`;
    }
  }

  if (actionLink) {
    actionLink.style.marginTop = `${Math.round(16 * stageScale)}px`;
    actionLink.style.fontSize = `${Math.round(14 * stageScale)}px`;
    if (overlay.content.style?.buttonLike) {
      actionLink.style.padding = `${Math.round(9 * stageScale)}px ${Math.round(14 * stageScale)}px`;
    }
  }
}

function applyTextStyles(
  element: HTMLElement,
  overlay: OverlayDefinition,
  extra: Partial<CSSStyleDeclaration> = {},
) {
  const style = overlay.content.style;
  Object.assign(element.style, {
    fontFamily: style?.fontFamily ?? "Inter",
    fontWeight: String(style?.fontWeight ?? 600),
    fontStyle: style?.italic ? "italic" : "normal",
    textDecoration: style?.underline ? "underline" : "none",
    color: style?.color ?? "#f6f7fb",
    textAlign: style?.textAlign === "start" ? "left" : style?.textAlign === "end" ? "right" : "center",
    letterSpacing: `${style?.letterSpacing ?? 0}em`,
    textTransform: style?.textTransform ?? "none",
    opacity: String(style?.opacity ?? 1),
    ...extra,
  });
}

function appendMediaElement(
  parent: HTMLElement,
  overlay: OverlayDefinition,
  mode: "desktop" | "mobile",
) {
  if (!overlay.content.mediaUrl) {
    const placeholder = document.createElement("div");
    placeholder.dataset.mediaField = "media";
    placeholder.style.width = "100%";
    placeholder.style.maxWidth = `${overlay.content.layout?.width ?? (mode === "mobile" ? 260 : 420)}px`;
    placeholder.style.height =
      overlay.content.type === "icon"
        ? "64px"
        : overlay.content.type === "logo"
          ? "80px"
          : "220px";
    placeholder.style.display = "flex";
    placeholder.style.alignItems = "center";
    placeholder.style.justifyContent = "center";
    placeholder.style.borderRadius = overlay.content.type === "image" ? ".7rem" : "0";
    placeholder.style.background = "rgba(128, 136, 152, 0.45)";
    placeholder.style.border = "1px solid rgba(255,255,255,0.08)";
    placeholder.style.marginBottom = overlay.content.text ? ".8rem" : "0";

    const icon = document.createElement("div");
    icon.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>';
    icon.style.width = "52px";
    icon.style.height = "52px";
    icon.style.borderRadius = "999px";
    icon.style.background = "rgba(1,1,1,0.7)";
    icon.style.border = "1px solid rgba(255,255,255,0.12)";
    icon.style.color = "rgba(255,255,255,0.58)";
    icon.style.display = "flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";

    placeholder.appendChild(icon);
    parent.appendChild(placeholder);
    return;
  }

  const image = document.createElement("img");
  image.src = overlay.content.mediaUrl;
  image.alt = overlay.content.text ?? "Overlay media";
  image.dataset.mediaField = "media";
  image.style.width = "100%";
  image.style.maxWidth = `${overlay.content.layout?.width ?? (mode === "mobile" ? 260 : 420)}px`;
  image.style.height = overlay.content.type === "icon" ? "64px" : overlay.content.type === "logo" ? "80px" : "auto";
  image.style.objectFit = overlay.content.type === "image" ? "cover" : "contain";
  image.style.borderRadius = overlay.content.type === "image" ? ".7rem" : "0";
  image.style.marginBottom = overlay.content.text ? ".8rem" : "0";
  parent.appendChild(image);
}

function syncOverlayPresentationStyles(
  overlayRoot: HTMLElement,
  section: ProjectSectionManifest,
  stageRoot: HTMLElement,
  mode: "desktop" | "mobile",
) {
  const stageScale = getStageScale(stageRoot);
  const overlayMap = new Map(section.overlays.map((overlay) => [overlay.id, overlay] as const));

  for (const child of Array.from(overlayRoot.querySelectorAll<HTMLElement>("[data-overlay-id]"))) {
    const card = child as HTMLElement;
    const overlay = overlayMap.get(card.dataset.overlayId ?? "");
    if (!overlay) {
      continue;
    }

    const parentOverlayId = overlay.content.parentGroupId;
    const parentOverlay = parentOverlayId ? overlayMap.get(parentOverlayId) : undefined;
    const parentPlacement = parentOverlay
      ? getOverlayPixelPlacement(parentOverlay, stageRoot, stageScale)
      : undefined;

    applyOverlayCardStyles(card, overlay, stageRoot, mode, stageScale, parentPlacement);
    applyOverlayContentStyles(card, overlay, stageScale);
  }
}

function renderOverlayState(
  root: HTMLElement,
  section: ProjectSectionManifest,
  progress: number,
) {
  const activeOverlayId = getActiveOverlayId(section.overlays, progress);
  const interactionMode = root.dataset.interactionMode ?? "scroll";
  const allowOverlayTransitions = root.dataset.overlayTransitions === "enabled";
  root.dataset.activeOverlayId = activeOverlayId ?? "";
  const overlayMap = new Map(section.overlays.map((item) => [item.id, item] as const));

  for (const element of Array.from(root.querySelectorAll<HTMLElement>("[data-overlay-id]"))) {
    const overlayElement = element as HTMLElement;
    const overlay = overlayMap.get(overlayElement.dataset.overlayId ?? "");
    if (!overlay) {
      continue;
    }

    const animationState = getOverlayAnimationState(overlay, section, progress);
    const nextState = animationState.active ? "active" : "inactive";
    const nextTransition =
      interactionMode === "controlled"
        ? "none"
        : allowOverlayTransitions
          ? getOverlayTransitionStyle(overlay)
          : "none";

    if (overlayElement.dataset.state !== nextState) {
      overlayElement.style.visibility = animationState.active ? "visible" : "hidden";
      overlayElement.style.pointerEvents = animationState.active ? "auto" : "none";
      overlayElement.ariaHidden = animationState.active ? "false" : "true";
      overlayElement.dataset.state = nextState;
    }
    const nextOpacity = String(Number(animationState.opacity.toFixed(4)));
    if (overlayElement.style.opacity !== nextOpacity) overlayElement.style.opacity = nextOpacity;
    if (overlayElement.style.transform !== animationState.transform) overlayElement.style.transform = animationState.transform;
    if (overlayElement.style.transition !== nextTransition) overlayElement.style.transition = nextTransition;
    if (overlayElement.style.filter !== animationState.filter) overlayElement.style.filter = animationState.filter;
    if (overlayElement.style.clipPath !== animationState.clipPath) overlayElement.style.clipPath = animationState.clipPath;
  }
}

function ensureOverlayRoot(
  container: HTMLElement,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  interactionMode: "scroll" | "controlled",
  allowOverlayTransitions: boolean,
  providedRoot?: HTMLElement,
) {
  const overlayRoot = providedRoot ?? document.createElement("div");
  overlayRoot.className = "motionroll-overlay-root absolute inset-0 z-20";
  overlayRoot.style.pointerEvents = "none";
  overlayRoot.dataset.interactionMode = interactionMode;
  overlayRoot.dataset.overlayTransitions =
    interactionMode === "controlled" && !allowOverlayTransitions ? "disabled" : "enabled";

  if (!providedRoot) {
    container.appendChild(overlayRoot);
  }

  if (overlayRoot.children.length === 0) {
    const overlayElements = new Map<string, HTMLElement>();
    const orderedOverlays = getOverlaysInStackOrder(section.overlays);
    for (const overlay of orderedOverlays) {
      const card = document.createElement("article");
      card.dataset.overlayId = overlay.id;
      card.dataset.contentType = overlay.content.type ?? "text";
      card.className = `motionroll-overlay motionroll-theme-${overlay.content.theme}`;
      card.style.transition =
        interactionMode === "controlled" && !allowOverlayTransitions
          ? "none"
          : getOverlayTransitionStyle(overlay);
      card.style.opacity = "0";
      card.style.visibility = "hidden";
      card.style.pointerEvents = "none";
      card.style.willChange = "transform, opacity, filter";
      card.style.zIndex = String(100 + (overlay.content.layer ?? 0));
      applyOverlayCardStyles(card, overlay, container, mode);

      if (overlay.content.type !== "text" && overlay.content.type !== "group") {
        appendMediaElement(card, overlay, mode);
      }

      if (overlay.content.text) {
        const textBlock = appendTextElement(card, "p", overlay.content.text, {
          margin: "0",
          whiteSpace: "pre-wrap",
          fontSize: `${(overlay.content.style?.fontSize ?? (mode === "mobile" ? 20 : 34)) * (mode === "mobile" ? 0.76 : 1)}px`,
          lineHeight: "1.1",
        }, "text", overlay.content.textHtml);
        applyTextStyles(textBlock, overlay, {
          margin: "0",
          whiteSpace: "pre-wrap",
          lineHeight: String(overlay.content.style?.lineHeight ?? 1.08),
        });
      }

      const actionableHref = overlay.content.linkHref ?? overlay.content.cta?.href;
      if (actionableHref) {
        const safeHref = getSafeHref(actionableHref);
        if (safeHref) {
          const link = document.createElement("a");
          link.textContent = overlay.content.cta?.label ?? "Open";
          link.href = safeHref;
          link.rel = safeHref.startsWith("http") ? "noreferrer noopener" : "";
          link.style.display = "inline-block";
          link.style.marginTop = "1rem";
          link.style.fontSize = ".85rem";
          link.style.fontWeight = "600";
          link.style.cursor = "pointer";
          if (overlay.content.style?.buttonLike) {
            link.style.padding = ".55rem .85rem";
            link.style.borderRadius = ".7rem";
            link.style.background = "rgba(214,246,255,0.92)";
            link.style.color = "#091117";
          }
          card.appendChild(link);
        }
      }

      overlayElements.set(overlay.id, card);
    }

    for (const overlay of orderedOverlays) {
      const card = overlayElements.get(overlay.id);
      if (!card) continue;
      const parent =
        overlay.content.parentGroupId
          ? overlayElements.get(overlay.content.parentGroupId) ?? overlayRoot
          : overlayRoot;
      parent.appendChild(card);
    }
  }

  for (const overlay of getOverlaysInStackOrder(section.overlays).filter((item) => !item.content.parentGroupId)) {
    const card = overlayRoot.querySelector<HTMLElement>(`[data-overlay-id="${overlay.id}"]`);
    if (!card) continue;
    card.style.zIndex = String(100 + (overlay.content.layer ?? 0));
    overlayRoot.appendChild(card);
  }

  syncOverlayPresentationStyles(overlayRoot, section, container, mode);

  return overlayRoot;
}

function ensureCanvas(container: HTMLElement, providedCanvas?: HTMLCanvasElement) {
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
  if (!providedCanvas) {
    container.appendChild(canvas);
  }
  return canvas;
}

function preloadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load frame: ${url}`));
    image.src = url;
  });
}

function ensureStageRoot(
  container: HTMLElement,
  interactionMode: "scroll" | "controlled",
) {
  if (interactionMode !== "scroll") {
    return container;
  }

  const stageRoot = document.createElement("div");
  stageRoot.className = "motionroll-stage-root";
  stageRoot.style.position = "sticky";
  stageRoot.style.top = "0";
  stageRoot.style.left = "0";
  stageRoot.style.width = "100%";
  stageRoot.style.height = "100vh";
  stageRoot.style.overflow = "hidden";
  stageRoot.style.background = "#000";
  container.appendChild(stageRoot);
  return stageRoot;
}

function createPosterPlaceholder(
  stageRoot: HTMLElement,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  progress = 0,
) {
  const source =
    getFrameUrlForProgress(section, mode, progress) ||
    section.fallback.posterUrl ||
    getFirstFrameUrl(section, mode);
  if (!source) {
    return null;
  }

  const poster = document.createElement("img");
  poster.src = source;
  poster.alt = section.title;
  poster.style.position = "absolute";
  poster.style.inset = "0";
  poster.style.width = "100%";
  poster.style.height = "100%";
  poster.style.objectFit = "cover";
  poster.style.zIndex = "2";
  poster.style.background = "#000";
  stageRoot.appendChild(poster);
  return poster;
}

function renderSequenceFrame(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = Math.max(1, containerSize(canvas, "width"));
  const cssHeight = Math.max(1, containerSize(canvas, "height"));

  if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = Math.max(cssWidth / image.naturalWidth, cssHeight / image.naturalHeight);
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

function renderBlankSequenceFrame(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = Math.max(1, containerSize(canvas, "width"));
  const cssHeight = Math.max(1, containerSize(canvas, "height"));

  if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  canvas.style.opacity = "1";
}

function containerSize(canvas: HTMLCanvasElement, axis: "width" | "height") {
  const rect = canvas.getBoundingClientRect();
  return axis === "width" ? rect.width : rect.height;
}

function renderFallback(
  stageRoot: HTMLElement,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  fallback: ResolvedFallbackStrategy,
) {
  if (fallback === "video" && section.fallback.fallbackVideoUrl) {
    const video = document.createElement("video");
    video.src = section.fallback.fallbackVideoUrl;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.style.width = "100%";
    video.style.height = "100%";
      video.style.objectFit = "cover";
    video.style.background = "#000";
    video.style.position = "absolute";
    video.style.inset = "0";
    stageRoot.appendChild(video);
    return () => video.remove();
  }

  const source =
    fallback === "first-frame"
      ? getFirstFrameUrl(section, mode)
      : section.fallback.posterUrl ?? getFirstFrameUrl(section, mode);

  if (!source) {
    return () => undefined;
  }

  const poster = document.createElement("img");
  poster.src = source;
  poster.alt = section.title;
  poster.style.position = "absolute";
  poster.style.inset = "0";
  poster.style.width = "100%";
  poster.style.height = "100%";
    poster.style.objectFit = "cover";
  poster.style.background = "#000";
  stageRoot.appendChild(poster);
  return () => poster.remove();
}

function createSequenceState(initialProgress = 0): SequenceProgressState {
  const progress = clampProgress(initialProgress);
  return {
    targetProgress: progress,
    currentProgress: progress,
  };
}

function isSequenceMediaVisibleAtProgress(
  section: ProjectSectionManifest,
  progress: number,
) {
  const frameCount = Math.max(section.frameCount, 1);
  const rangeStart = frameIndexToSequenceProgress(section.progressMapping.frameRange.start, frameCount);
  const rangeEnd = frameIndexToSequenceProgress(section.progressMapping.frameRange.end, frameCount);
  const normalized = clampProgress(progress);

  return normalized >= rangeStart && normalized <= rangeEnd + 0.0001;
}

export function createScrollSection(
  container: HTMLElement,
  manifest: ProjectManifest,
  options: CreateScrollSectionOptions = {},
): ScrollSectionController {
  const section = chooseSection(manifest);
  const { mode, fallback } = choosePlaybackMode(section, options);
  const interactionMode = options.interactionMode ?? "scroll";
  const stageRoot = ensureStageRoot(container, interactionMode);
  const overlayRoot = ensureOverlayRoot(
    stageRoot,
    section,
    mode,
    interactionMode,
    options.enableOverlayTransitions ?? false,
    options.overlayRoot,
  );
  const frameCache = new Map<number, HTMLImageElement>();
  const framePromiseCache = new Map<number, Promise<HTMLImageElement>>();
  const cleanups: Array<() => void> = [];
  const sequenceState = createSequenceState(options.initialProgress ?? 0);
  const scrollDistance =
    (options.scrollDistance ?? DEFAULT_SEQUENCE_SCROLL_DISTANCE) *
    Math.max(section.motion.scrubStrength ?? 1, 0.5);
  const isControlled = interactionMode === "controlled";
  let destroyed = false;
  let renderRequestId = 0;
  let latestRequestedFrameIndex: number | null = null;
  let lastRenderedFrameIndex: number | null = null;
  let animationFrame = 0;
  let tickActive = false;

  container.style.position = "relative";
  container.style.height =
    interactionMode === "controlled" ? "100%" : `${section.motion.sectionHeightVh}vh`;
  container.style.minHeight = interactionMode === "controlled" ? "0" : "100vh";
  container.style.overflow = interactionMode === "controlled" ? "hidden" : "visible";
  container.dataset.presetKind = section.runtimeProfile.kind;

  function stopTick() {
    if (animationFrame && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    tickActive = false;
  }

  function startTick() {
    if (destroyed || isControlled || tickActive || typeof requestAnimationFrame !== "function") {
      return;
    }

    tickActive = true;
    animationFrame = requestAnimationFrame(tick);
  }

  function updateTargetProgress(progress: number, emit = false) {
    sequenceState.targetProgress = clampProgress(progress);
    if (emit) {
      options.onProgressChange?.(sequenceState.targetProgress);
    }
    if (Math.abs(sequenceState.targetProgress - sequenceState.currentProgress) > DEFAULT_SEQUENCE_SETTLE_EPSILON) {
      startTick();
    }
  }

  function setImmediateProgress(progress: number) {
    const nextProgress = clampProgress(progress);
    sequenceState.targetProgress = nextProgress;
    sequenceState.currentProgress = nextProgress;
  }
  function syncScrollProgress() {
    if (interactionMode !== "scroll") {
      return;
    }

    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
    const rect = container.getBoundingClientRect();
    // In scroll mode, the end of the physical section should always map to progress 1.
    // Keep custom scrollDistance for wheel scrubbing, but derive page scroll from the
    // actual available section distance so the sequence finishes exactly at the bottom.
    const availableScrollDistance = Math.max(rect.height - viewportHeight, 1);
    const nextProgress = clampProgress((-rect.top) / availableScrollDistance);
    updateTargetProgress(nextProgress);
  }


  async function renderForProgress(progress: number) {
    const requestId = ++renderRequestId;

    if (destroyed) {
      return;
    }

    syncOverlayPresentationStyles(overlayRoot, section, stageRoot, mode);

    if (section.frameAssets.length === 0) {
      renderOverlayState(overlayRoot, section, progress);
      return;
    }

    const normalized = clampProgress(progress);
    renderOverlayState(overlayRoot, section, normalized);

    if (!isSequenceMediaVisibleAtProgress(section, normalized)) {
      renderBlankSequenceFrame(canvas);
      posterPlaceholder?.remove();
      lastRenderedFrameIndex = null;
      latestRequestedFrameIndex = null;
      return;
    }

    const desiredFrameIndex = progressToFrameIndex(
      getSequenceRangeLocalProgress(section, normalized),
      section.progressMapping.frameRange,
    );
    latestRequestedFrameIndex = desiredFrameIndex;
    const frame = getFrameByIndex(section.frameAssets, desiredFrameIndex);
    const frameUrl = frame ? chooseFrameUrl(frame, mode) : "";

    if (!frame || !frameUrl) {
      lastRenderedFrameIndex = null;
      renderOverlayState(overlayRoot, section, normalized);
      return;
    }

    if (!frameCache.has(frame.index)) {
      const cachedFallback = getFrameByIndex(
        Array.from(frameCache.keys()).map((index) => ({ index, path: "", variants: [] })),
        desiredFrameIndex,
      );
      if (cachedFallback) {
        const cachedImage = frameCache.get(cachedFallback.index);
        if (cachedImage) {
          renderSequenceFrame(canvas, cachedImage);
        }
      }

      if (!framePromiseCache.has(frame.index)) {
        framePromiseCache.set(
          frame.index,
          preloadImage(frameUrl)
            .then((image) => {
              frameCache.set(frame.index, image);
              framePromiseCache.delete(frame.index);
              if (!destroyed) {
                void renderForProgress(sequenceState.currentProgress);
              }
              return image;
            })
            .catch((error) => {
              framePromiseCache.delete(frame.index);
              throw error;
            }),
        );
      }

      try {
        await framePromiseCache.get(frame.index);
      } catch {
        return;
      }
    }

    if (destroyed || requestId !== renderRequestId || latestRequestedFrameIndex !== frame.index) {
      return;
    }

    const image = frameCache.get(frame.index);
    if (image) {
      renderSequenceFrame(canvas, image);
      posterPlaceholder?.remove();
      lastRenderedFrameIndex = frame.index;
    }

    const preloadTargets = new Set<number>();
    for (let offset = 1; offset <= section.motion.preloadWindow; offset += 1) {
      const forward = desiredFrameIndex + offset;
      const backward = desiredFrameIndex - offset;
      if (forward <= section.progressMapping.frameRange.end) preloadTargets.add(forward);
      if (backward >= section.progressMapping.frameRange.start) preloadTargets.add(backward);
    }

    for (const target of preloadTargets) {
      const preloadFrame = getFrameByIndex(section.frameAssets, target);
      if (!preloadFrame || frameCache.has(preloadFrame.index)) {
        continue;
      }

      const preloadUrl = chooseFrameUrl(preloadFrame, mode);
      if (!preloadUrl || framePromiseCache.has(preloadFrame.index)) {
        continue;
      }

      framePromiseCache.set(
        preloadFrame.index,
        preloadImage(preloadUrl)
          .then((image) => {
            if (!destroyed) {
              frameCache.set(preloadFrame.index, image);
            }
            framePromiseCache.delete(preloadFrame.index);
            return image;
          })
          .catch((error) => {
            framePromiseCache.delete(preloadFrame.index);
            throw error;
          }),
      );
    }
  }

  function tick() {
    if (destroyed) {
      return;
    }

    tickActive = false;
    const currentDelta = Math.abs(sequenceState.targetProgress - sequenceState.currentProgress);
    if (currentDelta <= DEFAULT_SEQUENCE_SETTLE_EPSILON) {
      if (sequenceState.currentProgress !== sequenceState.targetProgress) {
        sequenceState.currentProgress = sequenceState.targetProgress;
        void renderForProgress(sequenceState.currentProgress);
      }
      return;
    }

    const nextProgress = stepSequenceProgress(sequenceState);
    if (Math.abs(nextProgress - sequenceState.currentProgress) > 0.00001) {
      sequenceState.currentProgress = nextProgress;
      void renderForProgress(sequenceState.currentProgress);
    }

    if (Math.abs(sequenceState.targetProgress - sequenceState.currentProgress) > DEFAULT_SEQUENCE_SETTLE_EPSILON) {
      startTick();
    }
  }

  if (fallback !== "sequence") {
    cleanups.push(renderFallback(stageRoot, section, mode, fallback));
    renderOverlayState(overlayRoot, section, 0);

    return {
      destroy() {
        destroyed = true;
        cleanups.forEach((cleanup) => cleanup());
        if (!options.overlayRoot) {
          overlayRoot.remove();
        }
        if (interactionMode === "scroll" && stageRoot !== container) {
          stageRoot.remove();
        }
      },
      refresh() {
        renderOverlayState(overlayRoot, section, sequenceState.currentProgress);
      },
      setProgress(progress: number) {
        setImmediateProgress(progress);
        renderOverlayState(overlayRoot, section, sequenceState.currentProgress);
      },
      setTargetProgress(progress: number) {
        setImmediateProgress(progress);
        renderOverlayState(overlayRoot, section, sequenceState.currentProgress);
      },
      getProgress() {
        return sequenceState.currentProgress;
      },
      getTargetProgress() {
        return sequenceState.targetProgress;
      },
    };
  }

  const posterPlaceholder = createPosterPlaceholder(
    stageRoot,
    section,
    mode,
    sequenceState.currentProgress,
  );
  const canvas = ensureCanvas(stageRoot, options.canvas);
  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          lastRenderedFrameIndex = null;
          void renderForProgress(sequenceState.currentProgress);
        })
      : null;
  resizeObserver?.observe(container);

  if (interactionMode === "controlled" && options.allowWheelScrub) {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const nextProgress = clampProgress(
        sequenceState.targetProgress + event.deltaY / Math.max(scrollDistance, 1),
      );
      updateTargetProgress(nextProgress, true);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    cleanups.push(() => container.removeEventListener("wheel", handleWheel));
  }

  if (interactionMode === "scroll") {
    const handleScroll = () => syncScrollProgress();
    const handleResize = () => {
      lastRenderedFrameIndex = null;
      syncScrollProgress();
      void renderForProgress(sequenceState.currentProgress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    cleanups.push(() => window.removeEventListener("scroll", handleScroll));
    cleanups.push(() => window.removeEventListener("resize", handleResize));
    syncScrollProgress();
  }

  cleanups.push(() => {
    if (!options.canvas) {
      canvas.remove();
    }
  });
  cleanups.push(() => posterPlaceholder?.remove());
  cleanups.push(() => resizeObserver?.disconnect());

  void renderForProgress(sequenceState.currentProgress);
  if (!isControlled && Math.abs(sequenceState.targetProgress - sequenceState.currentProgress) > DEFAULT_SEQUENCE_SETTLE_EPSILON) {
    startTick();
  }

  return {
    destroy() {
      destroyed = true;
      stopTick();
      cleanups.forEach((cleanup) => cleanup());
      frameCache.clear();
      framePromiseCache.clear();
      lastRenderedFrameIndex = null;
      if (!options.overlayRoot) {
        overlayRoot.remove();
      }
      if (interactionMode === "scroll" && stageRoot !== container) {
        stageRoot.remove();
      }
    },
    refresh() {
      lastRenderedFrameIndex = null;
      syncScrollProgress();
      void renderForProgress(sequenceState.currentProgress);
    },
    setProgress(progress: number) {
      setImmediateProgress(progress);
      void renderForProgress(sequenceState.currentProgress);
    },
    setTargetProgress(progress: number) {
      updateTargetProgress(progress);
    },
    getProgress() {
      return sequenceState.currentProgress;
    },
    getTargetProgress() {
      return sequenceState.targetProgress;
    },
  };
}

export { getActiveOverlayId, getFrameByIndex, getOverlaysInStackOrder, progressToFrameIndex } from "./utils";
