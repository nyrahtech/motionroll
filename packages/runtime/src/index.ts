import {
  resolveFallbackStrategy,
  stepSequenceProgress,
  type AssetVariantKind,
  type FrameAsset,
  type OverlayDefinition,
  type ProjectManifest,
  type ProjectSectionManifest,
  type ResolvedFallbackStrategy,
  type SequenceProgressState,
} from "../../shared/src/index";
import { DEFAULT_SEQUENCE_SCROLL_DISTANCE } from "../../shared/src/sequence";
import { clampProgress } from "../../shared/src/timing";
import { clamp, getActiveOverlayId, getFrameByIndex, progressToFrameIndex } from "./utils";


export interface CreateScrollSectionOptions {
  mode?: "desktop" | "mobile";
  reducedMotion?: boolean;
  canvas?: HTMLCanvasElement;
  overlayRoot?: HTMLElement;
  interactionMode?: "scroll" | "controlled";
  allowWheelScrub?: boolean;
  onProgressChange?: (progress: number) => void;
  scrollDistance?: number;
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

function appendTextElement(
  parent: HTMLElement,
  tagName: "p" | "h3",
  text: string,
  style: Partial<CSSStyleDeclaration>,
  dataField?: string,
  html?: string,
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

function sanitizeRichTextHtml(input: string) {
  if (typeof window === "undefined" || !input.trim()) {
    return "";
  }

  const template = document.createElement("template");
  template.innerHTML = input;
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

function getOverlayTransform(
  overlay: OverlayDefinition,
  entrance: ProjectSectionManifest["runtimeProfile"]["overlayEntrance"],
  visible: boolean,
) {
  const animationPreset = overlay.content.animation?.preset ?? "fade";

  if (overlay.content.align === "center") {
    if (!visible && animationPreset === "scale-in") {
      return "translate3d(-50%, -50%, 0) scale(0.94)";
    }
    return visible ? "translate3d(-50%, -50%, 0)" : "translate3d(-50%, calc(-50% + 18px), 0)";
  }

  if (!visible) {
    if (animationPreset === "slide-up") {
      return "translate3d(0, 22px, 0)";
    }
    if (animationPreset === "slide-down") {
      return "translate3d(0, -22px, 0)";
    }
    if (animationPreset === "scale-in") {
      return "translate3d(0, 0, 0) scale(0.94)";
    }
    return entrance === "crossfade" ? "translate3d(0, 0, 0)" : "translate3d(0, 18px, 0)";
  }

  return "translate3d(0, 0, 0)";
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

function applyOverlayCardStyles(
  card: HTMLElement,
  overlay: OverlayDefinition,
  mode: "desktop" | "mobile",
) {
  const layout = overlay.content.layout;
  const style = overlay.content.style;
  const background = overlay.content.background;
  const defaultTop = mode === "mobile" ? "1rem" : "2rem";
  const defaultLeft = mode === "mobile" ? "1rem" : "2rem";

  card.style.position = "absolute";
  card.style.left = `${(layout?.x ?? 0.08) * 100}%`;
  card.style.top = `${(layout?.y ?? 0.12) * 100}%`;
  card.style.right = "auto";
  card.style.bottom = "auto";
  card.style.width = `${layout?.width ?? (mode === "mobile" ? 280 : 420)}px`;
  if (layout?.height) {
    card.style.minHeight = `${layout.height}px`;
  }
  card.style.maxWidth = `${style?.maxWidth ?? layout?.width ?? (mode === "mobile" ? 280 : 420)}px`;
  card.style.padding = mode === "mobile" ? "1rem" : "1.05rem";
  card.style.borderRadius = ".85rem";
  card.style.backdropFilter = "blur(18px)";
  card.style.cursor = "pointer";
  card.style.userSelect = "none";
  card.style.transform = overlay.content.align === "center" ? "translate3d(-50%, -50%, 0)" : "translate3d(0, 0, 0)";
  card.style.transformOrigin = "center center";
  card.style.opacity = String(style?.opacity ?? 1);
  card.style.background =
    background?.enabled && background.mode === "solid"
      ? withOpacity(background.color ?? "#0d1016", background.opacity ?? 0.82)
      : "transparent";
  card.style.borderColor = withOpacity(
    background?.borderColor ?? "#d6f6ff",
    background?.borderOpacity ?? 0,
  );
  card.style.borderWidth = background?.enabled ? "1px" : "0";
  card.style.borderStyle = "solid";
  card.style.borderRadius = `${background?.radius ?? 14}px`;
  card.style.padding = `${background?.paddingY ?? (mode === "mobile" ? 12 : 14)}px ${background?.paddingX ?? 18}px`;
  card.style.backdropFilter =
    background?.enabled && background.mode === "solid" ? "blur(18px)" : "none";

  if (!layout) {
    card.style.left = overlay.content.align === "center" ? "50%" : defaultLeft;
    card.style.top = overlay.content.align === "end" ? "auto" : defaultTop;
    card.style.bottom = overlay.content.align === "end" ? defaultTop : "auto";
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
    return;
  }

  const image = document.createElement("img");
  image.src = overlay.content.mediaUrl;
  image.alt = overlay.content.headline;
  image.dataset.mediaField = "media";
  image.style.width = "100%";
  image.style.maxWidth = `${overlay.content.layout?.width ?? (mode === "mobile" ? 260 : 420)}px`;
  image.style.height = overlay.content.type === "icon" ? "64px" : overlay.content.type === "logo" ? "80px" : "auto";
  image.style.objectFit = overlay.content.type === "image" ? "cover" : "contain";
  image.style.borderRadius = overlay.content.type === "image" ? ".7rem" : "0";
  image.style.marginBottom = overlay.content.headline ? ".8rem" : "0";
  parent.appendChild(image);
}

function renderOverlayState(
  root: HTMLElement,
  section: ProjectSectionManifest,
  progress: number,
) {
  const activeOverlayId = getActiveOverlayId(section.overlays, progress);
  const interactionMode = root.dataset.interactionMode ?? "scroll";
  root.dataset.activeOverlayId = activeOverlayId ?? "";
  const overlayMap = new Map(section.overlays.map((item) => [item.id, item] as const));

  for (const element of root.children) {
    const overlayElement = element as HTMLElement;
    const overlay = overlayMap.get(overlayElement.dataset.overlayId ?? "");
    if (!overlay) {
      continue;
    }

    const visible = progress >= overlay.timing.start && progress < overlay.timing.end + 0.0001;
    const nextState = visible ? "active" : "inactive";
    const nextTransform = getOverlayTransform(
      overlay,
      section.runtimeProfile.overlayEntrance,
      visible,
    );
    const nextTransition = interactionMode === "controlled" ? "none" : getOverlayTransitionStyle(overlay);
    const nextFilter = visible
      ? "blur(0px)"
      : overlay.content.transition?.preset === "blur-dissolve" || overlay.content.animation?.preset === "blur-in"
        ? "blur(10px)"
        : "blur(0px)";
    const nextClipPath =
      visible || overlay.content.transition?.preset !== "wipe"
        ? "inset(0% 0% 0% 0%)"
        : "inset(0% 100% 0% 0%)";

    if (overlayElement.dataset.state !== nextState) {
      overlayElement.style.opacity = visible ? "1" : "0";
      overlayElement.style.visibility = visible ? "visible" : "hidden";
      overlayElement.style.pointerEvents = visible ? "auto" : "none";
      overlayElement.ariaHidden = visible ? "false" : "true";
      overlayElement.dataset.state = nextState;
    }
    if (overlayElement.style.transform !== nextTransform) overlayElement.style.transform = nextTransform;
    if (overlayElement.style.transition !== nextTransition) overlayElement.style.transition = nextTransition;
    if (overlayElement.style.filter !== nextFilter) overlayElement.style.filter = nextFilter;
    if (overlayElement.style.clipPath !== nextClipPath) overlayElement.style.clipPath = nextClipPath;
  }
}

function ensureOverlayRoot(
  container: HTMLElement,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  interactionMode: "scroll" | "controlled",
  providedRoot?: HTMLElement,
) {
  const overlayRoot = providedRoot ?? document.createElement("div");
  overlayRoot.className = "motionroll-overlay-root absolute inset-0 z-20";
  overlayRoot.style.pointerEvents = "none";
  overlayRoot.dataset.interactionMode = interactionMode;

  if (!providedRoot) {
    container.appendChild(overlayRoot);
  }

  if (overlayRoot.children.length === 0) {
    for (const overlay of section.overlays) {
      const card = document.createElement("article");
      card.dataset.overlayId = overlay.id;
      card.dataset.contentType = overlay.content.type ?? "text";
      card.className = `motionroll-overlay motionroll-theme-${overlay.content.theme}`;
      card.style.transition =
        interactionMode === "controlled" ? "none" : getOverlayTransitionStyle(overlay);
      card.style.opacity = "0";
      card.style.visibility = "hidden";
      card.style.pointerEvents = "none";
      card.style.willChange = "transform, opacity, filter";
      card.style.zIndex = String(100 + (overlay.content.layer ?? 0));
      applyOverlayCardStyles(card, overlay, mode);

      if (overlay.content.type !== "text") {
        appendMediaElement(card, overlay, mode);
      }

      if (overlay.content.eyebrow) {
        const eyebrow = appendTextElement(card, "p", overlay.content.eyebrow, {
          margin: "0 0 .4rem",
          fontSize: ".75rem",
          letterSpacing: ".16em",
          textTransform: "uppercase",
          opacity: "0.72",
        }, "eyebrow", overlay.content.textHtml?.eyebrow);
        applyTextStyles(eyebrow, overlay, {
          fontSize: ".72rem",
          margin: "0 0 .4rem",
          opacity: "0.72",
        });
      }

      const headline = appendTextElement(card, "h3", overlay.content.headline, {
        margin: "0 0 .6rem",
        fontSize: `${(overlay.content.style?.fontSize ?? (mode === "mobile" ? 20 : 34)) * (mode === "mobile" ? 0.76 : 1)}px`,
        lineHeight: "1.1",
      }, "headline", overlay.content.textHtml?.headline);
      applyTextStyles(headline, overlay, {
        margin: "0 0 .6rem",
        lineHeight: String(overlay.content.style?.lineHeight ?? 1.08),
      });

      const body = appendTextElement(card, "p", overlay.content.body, {
        margin: "0",
        fontSize: mode === "mobile" ? ".88rem" : ".95rem",
        lineHeight: "1.55",
        opacity: "0.82",
      }, "body", overlay.content.textHtml?.body);
      applyTextStyles(body, overlay, {
        margin: "0",
        fontSize: mode === "mobile" ? ".84rem" : ".95rem",
        lineHeight: String(Math.max(overlay.content.style?.lineHeight ?? 1.08, 1.2)),
        opacity: "0.82",
      });

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

      overlayRoot.appendChild(card);
    }
  }

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

function createPosterPlaceholder(
  container: HTMLElement,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
) {
  const source = section.fallback.posterUrl ?? getFirstFrameUrl(section, mode);
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
  poster.style.zIndex = "0";
  container.appendChild(poster);
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
  ctx.drawImage(image, x, y, width, height);
}

function containerSize(canvas: HTMLCanvasElement, axis: "width" | "height") {
  const rect = canvas.getBoundingClientRect();
  return axis === "width" ? rect.width : rect.height;
}

function renderFallback(
  container: HTMLElement,
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
    container.appendChild(video);
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
  poster.style.width = "100%";
  poster.style.height = "100%";
  poster.style.objectFit = "cover";
  container.appendChild(poster);
  return () => poster.remove();
}

function createSequenceState(initialProgress = 0): SequenceProgressState {
  const progress = clampProgress(initialProgress);
  return {
    targetProgress: progress,
    currentProgress: progress,
  };
}

export function createScrollSection(
  container: HTMLElement,
  manifest: ProjectManifest,
  options: CreateScrollSectionOptions = {},
): ScrollSectionController {
  const section = chooseSection(manifest);
  const { mode, fallback } = choosePlaybackMode(section, options);
  const interactionMode = options.interactionMode ?? "scroll";
  const overlayRoot = ensureOverlayRoot(
    container,
    section,
    mode,
    interactionMode,
    options.overlayRoot,
  );
  const frameCache = new Map<number, HTMLImageElement>();
  const framePromiseCache = new Map<number, Promise<HTMLImageElement>>();
  const cleanups: Array<() => void> = [];
  const sequenceState = createSequenceState(0);
  const scrollDistance = options.scrollDistance ?? DEFAULT_SEQUENCE_SCROLL_DISTANCE;
  let destroyed = false;
  let renderRequestId = 0;
  let lastRenderedFrameIndex: number | null = null;
  let animationFrame = 0;

  container.style.position = "relative";
  container.style.height =
    interactionMode === "controlled" ? "100%" : `${section.motion.sectionHeightVh}vh`;
  container.style.overflow = "hidden";
  container.dataset.presetKind = section.runtimeProfile.kind;

  function stopTick() {
    if (animationFrame && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }

  function updateTargetProgress(progress: number, emit = false) {
    sequenceState.targetProgress = clampProgress(progress);
    if (emit) {
      options.onProgressChange?.(sequenceState.targetProgress);
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
    const usableDistance = Math.max(rect.height - viewportHeight, scrollDistance, 1);
    const nextProgress = clampProgress((-rect.top) / usableDistance);
    updateTargetProgress(nextProgress);
  }


  async function renderForProgress(progress: number) {
    const requestId = ++renderRequestId;

    if (destroyed) {
      return;
    }

    if (section.frameAssets.length === 0) {
      renderOverlayState(overlayRoot, section, progress);
      return;
    }

    const normalized = clampProgress(progress);
    const desiredFrameIndex = progressToFrameIndex(normalized, section.progressMapping.frameRange);
    const frame = getFrameByIndex(section.frameAssets, desiredFrameIndex);
    const frameUrl = frame ? chooseFrameUrl(frame, mode) : "";

    if (!frame || !frameUrl) {
      lastRenderedFrameIndex = null;
      renderOverlayState(overlayRoot, section, normalized);
      return;
    }

    if (!frameCache.has(frame.index)) {
      if (!framePromiseCache.has(frame.index)) {
        framePromiseCache.set(
          frame.index,
          preloadImage(frameUrl)
            .then((image) => {
              frameCache.set(frame.index, image);
              framePromiseCache.delete(frame.index);
              return image;
            })
            .catch((error) => {
              framePromiseCache.delete(frame.index);
              throw error;
            }),
        );
      }

      await framePromiseCache.get(frame.index);
    }

    if (destroyed || requestId !== renderRequestId) {
      return;
    }

    const image = frameCache.get(frame.index);
    if (image && lastRenderedFrameIndex !== frame.index) {
      const canvas = ensureCanvas(container, options.canvas);
      renderSequenceFrame(canvas, image);
      posterPlaceholder?.remove();
      lastRenderedFrameIndex = frame.index;
    }

    renderOverlayState(overlayRoot, section, normalized);

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

    const nextProgress = stepSequenceProgress(sequenceState);
    if (Math.abs(nextProgress - sequenceState.currentProgress) > 0.00001) {
      sequenceState.currentProgress = nextProgress;
      void renderForProgress(sequenceState.currentProgress);
    }

    if (typeof requestAnimationFrame === "function") {
      animationFrame = requestAnimationFrame(tick);
    }
  }

  if (fallback !== "sequence") {
    cleanups.push(renderFallback(container, section, mode, fallback));
    renderOverlayState(overlayRoot, section, 0);

    return {
      destroy() {
        destroyed = true;
        cleanups.forEach((cleanup) => cleanup());
        if (!options.overlayRoot) {
          overlayRoot.remove();
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

  const posterPlaceholder = createPosterPlaceholder(container, section, mode);
  const canvas = ensureCanvas(container, options.canvas);
  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          lastRenderedFrameIndex = null;
          void renderForProgress(sequenceState.currentProgress);
        })
      : null;
  resizeObserver?.observe(container);

  if (typeof requestAnimationFrame === "function") {
    animationFrame = requestAnimationFrame(tick);
  }

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
    const stickyNodes: HTMLElement[] = [];
    if (!options.canvas) {
      stickyNodes.push(canvas);
    }
    if (!options.overlayRoot) {
      stickyNodes.push(overlayRoot);
    }
    stickyNodes.forEach((node) => {
      node.style.position = "sticky";
      node.style.top = "0";
      node.style.left = "0";
      node.style.width = "100%";
      node.style.height = "100vh";
    });

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

export { getActiveOverlayId, getFrameByIndex, progressToFrameIndex } from "./utils";
