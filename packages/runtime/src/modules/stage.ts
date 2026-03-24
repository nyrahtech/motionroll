/**
 * stage — DOM scaffolding for MotionRoll scroll stages.
 * Creates the sticky viewport, poster placeholder, and fallback media elements.
 */
import type { ProjectSectionManifest, ResolvedFallbackStrategy } from "../../../shared/src/index";
import type { RenderFallbackResult } from "./types";
import { getFirstFrameUrl, getFrameUrlForProgress } from "./frame-controller";

export function ensureStageRoot(
  container: HTMLElement,
  interactionMode: "scroll" | "controlled",
): HTMLElement {
  if (interactionMode !== "scroll") {
    return container;
  }
  const stageRoot = document.createElement("div");
  stageRoot.className = "motionroll-stage-root";
  stageRoot.style.cssText =
    "position:sticky;top:0;left:0;width:100%;height:100vh;overflow:hidden;background:#000";
  container.appendChild(stageRoot);
  return stageRoot;
}

export function createPosterPlaceholder(
  stageRoot: HTMLElement,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  progress = 0,
): HTMLImageElement | null {
  const source =
    getFrameUrlForProgress(section, mode, progress) ||
    section.fallback.posterUrl ||
    getFirstFrameUrl(section, mode);
  if (!source) return null;

  const poster = document.createElement("img");
  poster.src = source;
  poster.alt = section.title;
  poster.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;background:#000";
  stageRoot.appendChild(poster);
  return poster;
}

export function renderFallback(
  stageRoot: HTMLElement,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  fallback: ResolvedFallbackStrategy,
  interactionMode: "scroll" | "controlled" = "scroll",
): RenderFallbackResult {
  if (fallback === "video" && section.fallback.fallbackVideoUrl) {
    const video = document.createElement("video");
    video.src = section.fallback.fallbackVideoUrl;
    video.autoplay = interactionMode !== "controlled";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.poster =
      section.fallback.posterUrl ??
      getFirstFrameUrl(section, mode) ??
      "";
    video.style.cssText =
      "width:100%;height:100%;object-fit:cover;background:#000;position:absolute;inset:0";
    stageRoot.appendChild(video);
    return {
      video,
      cleanup: () => video.remove(),
    };
  }

  const source =
    fallback === "first-frame"
      ? getFirstFrameUrl(section, mode)
      : section.fallback.posterUrl ?? getFirstFrameUrl(section, mode);
  if (!source) {
    return { cleanup: () => undefined };
  }

  const poster = document.createElement("img");
  poster.src = source;
  poster.alt = section.title;
  poster.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000";
  stageRoot.appendChild(poster);
  return {
    cleanup: () => poster.remove(),
  };
}
