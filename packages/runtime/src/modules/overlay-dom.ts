/**
 * overlay-dom.ts — DOM mutation functions that apply overlay states to the page.
 * Depends on overlay-calc.ts for pure calculations.
 */
import {
  type OverlayDefinition,
  type ProjectSectionManifest,
} from "../../../shared/src/index";
import { getActiveOverlayId, getOverlaysInStackOrder } from "../utils";
import {
  applyMotionEasing,
  formatPx,
  formatScale,
  getBaseOverlayTranslate,
  getOverlayAnimationState,
  getOverlayHiddenOffset,
  getOverlayPixelPlacement,
  getOverlayTransform,
  getOverlayTransitionStyle,
  getStageScale,
  getTimedProgress,
  hexToRgbTuple,
  normalizeRichTextHtml,
  sanitizeRichTextHtml,
  getSafeHref,
  withOpacity,
} from "./overlay-calc";

export function appendTextElement(
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

export function applyOverlayCardStyles(
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

export function applyOverlayContentStyles(
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

export function applyTextStyles(
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

export function appendMediaElement(
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

export function syncOverlayPresentationStyles(
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

export function renderOverlayState(
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

export function ensureOverlayRoot(
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


