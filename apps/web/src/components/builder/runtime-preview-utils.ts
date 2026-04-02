"use client";

import type { ProjectManifest } from "@motionroll/shared";
import {
  resolveOverlayBlendModeCssValue,
  withOpacity,
} from "@motionroll/runtime";

export const DESIGN_STAGE_WIDTH = 1440;
export const DESIGN_STAGE_HEIGHT = 810;

export function getOverlayPixelPlacement(
  overlay: ProjectManifest["sections"][number]["overlays"][number],
  container: HTMLElement,
  scale: number,
) {
  const layout = overlay.content.layout;
  const width = Math.round((layout?.width ?? 420) * scale);
  const height = layout?.height ? Math.round(layout.height * scale) : undefined;
  const centerAligned = overlay.content.align === "center";
  const anchorLeft = (layout?.x ?? (centerAligned ? 0.5 : 0.08)) * Math.max(container.clientWidth, 1);
  const anchorTop = (layout?.y ?? (centerAligned ? 0.5 : 0.12)) * Math.max(container.clientHeight, 1);
  return {
    width,
    height,
    anchorLeft,
    anchorTop,
    left: centerAligned ? anchorLeft - width / 2 : anchorLeft,
    top: centerAligned ? anchorTop - (height ?? 0) / 2 : anchorTop,
  };
}

export function isMediaOverlay(
  overlay: ProjectManifest["sections"][number]["overlays"][number],
) {
  return (
    overlay.content.type === "image" ||
    overlay.content.type === "logo" ||
    overlay.content.type === "icon"
  );
}

export function isBlendedMediaOverlay(
  overlay: ProjectManifest["sections"][number]["overlays"][number],
) {
  return isMediaOverlay(overlay) && (overlay.content.blendMode ?? "normal") !== "normal";
}

export function getSectionMediaSignature(section?: ProjectManifest["sections"][number]) {
  if (!section) {
    return "";
  }
  return JSON.stringify({
    backgroundMediaUrl: section.backgroundMedia?.url ?? "",
    backgroundMediaPreviewUrl: section.backgroundMedia?.previewUrl ?? "",
    posterUrl: section.fallback.posterUrl ?? "",
    fallbackVideoUrl: section.fallback.fallbackVideoUrl ?? "",
    firstFrameUrl: section.fallback.firstFrameUrl ?? "",
    frameSamples: section.frameAssets.slice(0, 3).map((frame) => frame.variants[0]?.url ?? ""),
  });
}

export function getManifestSection(manifest: ProjectManifest) {
  return manifest.sections[0];
}

export function hasRenderableSectionContent(section?: ProjectManifest["sections"][number]) {
  if (!section) {
    return false;
  }
  return (
    Boolean(section.backgroundMedia?.url || section.backgroundMedia?.previewUrl) ||
    section.frameAssets.length > 0 ||
    Boolean(section.fallback.posterUrl) ||
    Boolean(section.fallback.fallbackVideoUrl) ||
    section.overlays.length > 0
  );
}

export function hasRenderableCanvasContent(manifest: ProjectManifest) {
  return (
    Boolean(manifest.canvas.backgroundTrack?.media.url || manifest.canvas.backgroundTrack?.media.previewUrl) ||
    manifest.canvas.frameAssets.length > 0 ||
    Boolean(manifest.canvas.fallback.posterUrl) ||
    Boolean(manifest.canvas.fallback.fallbackVideoUrl) ||
    manifest.layers.length > 0
  );
}

export function applyManifestOverlayStyles(
  manifest: ProjectManifest,
  container: HTMLElement,
  onWireInteractivity: () => void,
): void {
  const sec = getManifestSection(manifest);
  if (!sec) return;

  const cW = Math.max(container.clientWidth, 1);
  const cH = Math.max(container.clientHeight, 1);
  const scale = Math.max(0.35, Math.min(cW / DESIGN_STAGE_WIDTH, cH / DESIGN_STAGE_HEIGHT));
  const overlayRoot = container.querySelector(".motionroll-overlay-root");

  if (overlayRoot instanceof HTMLElement) {
    const orderedOverlays = [...sec.overlays]
      .filter((overlay) => !overlay.content.parentGroupId)
      .sort(
        (left, right) => (left.content.layer ?? 0) - (right.content.layer ?? 0),
      );

    for (const overlay of orderedOverlays) {
      const card = overlayRoot.querySelector<HTMLElement>(`[data-overlay-id="${overlay.id}"]`);
      if (!card) continue;
      card.style.zIndex = String(100 + (overlay.content.layer ?? 0));
      overlayRoot.appendChild(card);
    }
  }

  const placementCache = new Map<string, ReturnType<typeof getOverlayPixelPlacement>>();
  const getPlacement = (ov: (typeof sec.overlays)[number]) => {
    if (!placementCache.has(ov.id)) {
      placementCache.set(ov.id, getOverlayPixelPlacement(ov, container, scale));
    }
    return placementCache.get(ov.id)!;
  };

  for (const overlay of sec.overlays) {
    const card = container.querySelector<HTMLElement>(`[data-overlay-id="${overlay.id}"]`);
    if (!card) continue;

    const layout = overlay.content.layout;
    const style = overlay.content.style;
    const bg = overlay.content.background;
    const mediaOverlay = isMediaOverlay(overlay);
    const blendedMediaOverlay = isBlendedMediaOverlay(overlay);
    const contentSizedOverlay = overlay.content.type === "text" && !bg?.enabled;
    const placement = getPlacement(overlay);
    const parentOverlay = overlay.content.parentGroupId
      ? sec.overlays.find((item) => item.id === overlay.content.parentGroupId)
      : undefined;
    const parentPlacement = parentOverlay
      ? getPlacement(parentOverlay)
      : undefined;

    card.style.position = "absolute";
    card.style.left = overlay.content.align === "center"
      ? `${Math.round((parentPlacement ? placement.anchorLeft - parentPlacement.left : placement.anchorLeft))}px`
      : `${Math.round((parentPlacement ? placement.left - parentPlacement.left : placement.left))}px`;
    card.style.top = overlay.content.align === "center"
      ? `${Math.round((parentPlacement ? placement.anchorTop - parentPlacement.top : placement.anchorTop))}px`
      : `${Math.round((parentPlacement ? placement.top - parentPlacement.top : placement.top))}px`;
    card.style.right = "auto";
    card.style.bottom = "auto";
    card.style.width = contentSizedOverlay ? "auto" : `${placement.width}px`;
    card.style.minHeight = placement.height && !contentSizedOverlay ? `${placement.height}px` : "";
    card.style.height = placement.height && !contentSizedOverlay ? `${placement.height}px` : "";
    card.style.maxWidth = overlay.content.type === "group"
      ? `${placement.width}px`
      : `${Math.round((style?.maxWidth ?? layout?.width ?? 420) * scale)}px`;
    card.style.zIndex = String(100 + (overlay.content.layer ?? 0));
    card.style.transform = overlay.content.align === "center"
      ? "translate3d(-50%,-50%,0)"
      : "translate3d(0,0,0)";
    card.style.overflow = overlay.content.type === "group" || blendedMediaOverlay ? "visible" : "hidden";
    card.style.backgroundClip = "padding-box";

    if (!layout) {
      card.style.left = overlay.content.align === "center" ? "50%" : `${Math.round(32 * scale)}px`;
      card.style.top = overlay.content.align === "end" ? "auto" : `${Math.round(32 * scale)}px`;
      card.style.bottom = overlay.content.align === "end" ? `${Math.round(32 * scale)}px` : "auto";
    }

    card.style.opacity = String(style?.opacity ?? 1);
    card.style.mixBlendMode = "normal";
    card.style.padding = overlay.content.type === "group"
      ? "0px"
      : contentSizedOverlay
        ? "0px"
        : `${Math.round((bg?.paddingY ?? 14) * scale)}px ${Math.round((bg?.paddingX ?? 18) * scale)}px`;
    card.style.borderRadius = `${bg?.radius ?? 14}px`;
    card.style.borderWidth = bg?.enabled ? "1px" : "0";
    card.style.borderStyle = overlay.content.type === "group" ? "dashed" : "solid";
    card.style.borderColor = withOpacity(
      bg?.borderColor ?? "#d6f6ff",
      bg?.borderOpacity ?? (overlay.content.type === "group" ? 0.18 : 0),
    );
    card.style.background = bg?.enabled
      ? withOpacity(bg.color ?? "#0d1016", bg.opacity ?? 0.82)
      : overlay.content.type === "group"
        ? "rgba(205,239,255,0.035)"
        : "transparent";
    card.style.borderWidth = bg?.enabled || overlay.content.type === "group" ? "1px" : "0";
    card.style.backdropFilter = bg?.enabled ? "blur(18px)" : "none";
    card.style.boxShadow =
      bg?.enabled || overlay.content.type === "group"
        ? "0 10px 28px rgba(0, 0, 0, 0.22)"
        : "none";

    if (overlay.content.type === "group") {
      continue;
    }

    const textAlign = style?.textAlign === "start" ? "left"
      : style?.textAlign === "end" ? "right"
      : "center";
    const sharedText: Partial<CSSStyleDeclaration> = {
      fontFamily: style?.fontFamily ?? "Inter",
      fontWeight: String(style?.fontWeight ?? 600),
      fontStyle: style?.italic ? "italic" : "normal",
      textDecoration: style?.underline ? "underline" : "none",
      color: style?.color ?? "#f6f7fb",
      textAlign,
      letterSpacing: `${style?.letterSpacing ?? 0}em`,
      textTransform: (style?.textTransform ?? "none") as string,
    };

    const textBlock = card.querySelector<HTMLElement>('[data-text-field="text"]');
    if (textBlock) {
      Object.assign(textBlock.style, {
        ...sharedText,
        fontSize: `${Math.round((style?.fontSize ?? 34) * scale)}px`,
        lineHeight: String(style?.lineHeight ?? 1.08),
        whiteSpace: "pre-wrap",
      });
    }

    const media = card.querySelector<HTMLElement>("[data-media-field='media']");
    if (media) {
      media.style.maxWidth = `${Math.round((layout?.width ?? 420) * scale)}px`;
      media.style.mixBlendMode = mediaOverlay
        ? resolveOverlayBlendModeCssValue(overlay.content.blendMode)
        : "normal";
      media.style.background = "transparent";
      media.style.display = "block";
      if (blendedMediaOverlay) {
        media.style.borderRadius = "0";
      }
      if (overlay.content.type === "icon") media.style.height = `${Math.round(64 * scale)}px`;
      else if (overlay.content.type === "logo") media.style.height = `${Math.round(80 * scale)}px`;
    }

    const actionLink = card.querySelector<HTMLElement>("a");
    if (actionLink) {
      actionLink.style.marginTop = `${Math.round(16 * scale)}px`;
      actionLink.style.fontSize = `${Math.round(14 * scale)}px`;
      actionLink.style.cursor = "pointer";
      actionLink.style.transition = "opacity 140ms ease, transform 140ms ease, box-shadow 140ms ease";
      actionLink.style.textUnderlineOffset = "0.18em";
      if (style?.buttonLike) actionLink.style.padding = `${Math.round(9 * scale)}px ${Math.round(14 * scale)}px`;
    }
  }

  onWireInteractivity();
}
