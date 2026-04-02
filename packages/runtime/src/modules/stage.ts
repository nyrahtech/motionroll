/**
 * stage — DOM scaffolding for MotionRoll scroll stages.
 * Creates the sticky viewport, poster placeholder, and fallback media elements.
 */
import type { ProjectSectionManifest, ResolvedFallbackStrategy } from "../../../shared/src/index";
import type { RenderFallbackResult } from "./types";
import { getFirstFrameUrl, getFrameUrlForProgress } from "./frame-controller";

const BACKGROUND_VIDEO_EPSILON_SECONDS = 1 / 120;
const NATURAL_VIDEO_DRIFT_TOLERANCE_SECONDS = 0.18;

function syncBackgroundPosterVisibility(video: HTMLVideoElement | null, visible: boolean) {
  const parent =
    video?.parentElement ??
    ((video as unknown as { parent?: Element | null }).parent ?? null);
  const poster = parent?.querySelector<HTMLImageElement>(
    '[data-scene-background-poster="true"]',
  );
  if (!poster) {
    return;
  }

  const shouldHide =
    visible &&
    (((video?.readyState ?? 0) >= 2) ||
      !video?.paused ||
      (video?.currentTime ?? 0) > BACKGROUND_VIDEO_EPSILON_SECONDS);

  poster.style.opacity = shouldHide ? "0" : "1";
  poster.style.visibility = shouldHide ? "hidden" : "visible";
}

function getSceneDurationSeconds(section: ProjectSectionManifest) {
  const frameSpan = Math.max(
    section.progressMapping.frameRange.end - section.progressMapping.frameRange.start + 1,
    1,
  );
  return Math.max(frameSpan / 24, BACKGROUND_VIDEO_EPSILON_SECONDS);
}

function getBackgroundSourceDurationSeconds(
  section: ProjectSectionManifest,
  video: HTMLVideoElement | null,
) {
  const durationMs = section.backgroundMedia?.metadata?.durationMs;
  if (typeof durationMs === "number" && durationMs > 0) {
    return durationMs / 1000;
  }

  return Number.isFinite(video?.duration) && (video?.duration ?? 0) > 0
    ? (video?.duration ?? 0)
    : 0;
}

function getResolvedBackgroundWindowSeconds(
  section: ProjectSectionManifest,
  video: HTMLVideoElement | null,
) {
  const sourceDurationSeconds = getBackgroundSourceDurationSeconds(section, video);
  const startSeconds = Math.max((section.backgroundVideoRange?.startMs ?? 0) / 1000, 0);
  const rawEndSeconds =
    typeof section.backgroundVideoRange?.endMs === "number"
      ? section.backgroundVideoRange.endMs / 1000
      : sourceDurationSeconds > 0
        ? sourceDurationSeconds
        : undefined;

  if (typeof rawEndSeconds !== "number" || rawEndSeconds <= 0) {
    return null;
  }

  const clampedStartSeconds = Math.min(startSeconds, Math.max(rawEndSeconds - BACKGROUND_VIDEO_EPSILON_SECONDS, 0));
  const clampedEndSeconds = Math.max(
    clampedStartSeconds + BACKGROUND_VIDEO_EPSILON_SECONDS,
    Math.min(rawEndSeconds, sourceDurationSeconds || rawEndSeconds),
  );

  return {
    startSeconds: clampedStartSeconds,
    endSeconds: clampedEndSeconds,
    durationSeconds: Math.max(
      clampedEndSeconds - clampedStartSeconds,
      BACKGROUND_VIDEO_EPSILON_SECONDS,
    ),
  };
}

function getBackgroundPlaybackState(
  section: ProjectSectionManifest,
  progress: number,
  video: HTMLVideoElement | null,
) {
  const window = getResolvedBackgroundWindowSeconds(section, video);
  if (!window) {
    return null;
  }

  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const sceneDurationSeconds = getSceneDurationSeconds(section);
  const localSceneSeconds = normalizedProgress * sceneDurationSeconds;
  const endBehavior = section.backgroundVideoEndBehavior ?? "loop";

  if (sceneDurationSeconds <= window.durationSeconds) {
    return {
      visible: true,
      currentTime: Math.max(
        window.startSeconds,
        Math.min(
          window.endSeconds - BACKGROUND_VIDEO_EPSILON_SECONDS,
          window.startSeconds + normalizedProgress * window.durationSeconds,
        ),
      ),
    };
  }

  if (endBehavior === "loop") {
    const loopOffsetSeconds =
      ((localSceneSeconds % window.durationSeconds) + window.durationSeconds) % window.durationSeconds;
    return {
      visible: true,
      currentTime: Math.max(
        window.startSeconds,
        Math.min(
          window.endSeconds - BACKGROUND_VIDEO_EPSILON_SECONDS,
          window.startSeconds + loopOffsetSeconds,
        ),
      ),
    };
  }

  if (endBehavior === "hold") {
    if (localSceneSeconds < window.durationSeconds) {
      return {
        visible: true,
        currentTime: Math.max(
          window.startSeconds,
          Math.min(
            window.endSeconds - BACKGROUND_VIDEO_EPSILON_SECONDS,
            window.startSeconds + localSceneSeconds,
          ),
        ),
      };
    }

    return {
      visible: true,
      currentTime: Math.max(
        window.startSeconds,
        window.endSeconds - BACKGROUND_VIDEO_EPSILON_SECONDS,
      ),
    };
  }

  if (localSceneSeconds >= window.durationSeconds) {
    return {
      visible: false,
      currentTime: Math.max(
        window.startSeconds,
        window.endSeconds - BACKGROUND_VIDEO_EPSILON_SECONDS,
      ),
    };
  }

  return {
    visible: true,
    currentTime: Math.max(
      window.startSeconds,
      Math.min(
        window.endSeconds - BACKGROUND_VIDEO_EPSILON_SECONDS,
        window.startSeconds + localSceneSeconds,
      ),
    ),
  };
}

function canUseNaturalBackgroundPlayback(
  section: ProjectSectionManifest,
  video: HTMLVideoElement | null,
  progress: number,
) {
  if (
    !video ||
    video.dataset.motionrollPlayback !== "playing" ||
    video.paused ||
    (video.readyState ?? 0) < 2
  ) {
    return false;
  }

  const window = getResolvedBackgroundWindowSeconds(section, video);
  if (!window) {
    return false;
  }

  const playbackState = getBackgroundPlaybackState(section, progress, video);
  if (!playbackState?.visible) {
    return false;
  }

  const currentTime = video.currentTime ?? 0;
  if (Math.abs(currentTime - playbackState.currentTime) > NATURAL_VIDEO_DRIFT_TOLERANCE_SECONDS) {
    return false;
  }

  const sourceDurationSeconds = getBackgroundSourceDurationSeconds(section, video);
  const sceneDurationSeconds = getSceneDurationSeconds(section);
  const endBehavior = section.backgroundVideoEndBehavior ?? "loop";

  if (
    sceneDurationSeconds <= window.durationSeconds &&
    currentTime >= window.startSeconds - BACKGROUND_VIDEO_EPSILON_SECONDS &&
    currentTime <= window.endSeconds
  ) {
    return true;
  }

  return (
    endBehavior === "loop" &&
    sourceDurationSeconds > 0 &&
    Math.abs(sceneDurationSeconds - window.durationSeconds) <= NATURAL_VIDEO_DRIFT_TOLERANCE_SECONDS &&
    window.startSeconds <= BACKGROUND_VIDEO_EPSILON_SECONDS &&
    Math.abs(window.endSeconds - sourceDurationSeconds) <= NATURAL_VIDEO_DRIFT_TOLERANCE_SECONDS
  );
}

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
      "width:100%;height:100%;object-fit:cover;background:#000;position:absolute;inset:0;z-index:1";
    stageRoot.appendChild(video);
    return {
      element: video,
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
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:1";
  stageRoot.appendChild(poster);
  return {
    element: poster,
    cleanup: () => poster.remove(),
  };
}

export function syncBackgroundVideo(
  stageRoot: HTMLElement,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
) {
  const existing = stageRoot.querySelector<HTMLVideoElement>('[data-scene-background-video="true"]');
  const existingPoster = stageRoot.querySelector<HTMLImageElement>('[data-scene-background-poster="true"]');
  const backgroundMedia = section.backgroundMedia;
  stageRoot.style.background = section.backgroundColor ?? "#000";

  if (!backgroundMedia?.url) {
    existing?.remove();
    existingPoster?.remove();
    return null;
  }

  const posterUrl =
    backgroundMedia.posterUrl ??
    section.fallback.posterUrl ??
    getFirstFrameUrl(section, mode) ??
    "";
  const poster = posterUrl
    ? existingPoster ?? document.createElement("img")
    : null;
  if (poster) {
    poster.dataset.sceneBackgroundPoster = "true";
    poster.src = posterUrl;
    poster.alt = section.title;
    poster.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;background:#000;opacity:1;visibility:visible;transition:opacity 120ms ease";
    if (!existingPoster) {
      stageRoot.appendChild(poster);
    }
  } else {
    existingPoster?.remove();
  }

  const video = existing ?? document.createElement("video");
  const sourceChanged = video.src !== backgroundMedia.url;
  video.dataset.sceneBackgroundVideo = "true";
  if (sourceChanged) {
    video.src = backgroundMedia.url;
  }
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.loop = false;
  video.autoplay = false;
  video.dataset.motionrollPlayback = "paused";
  video.poster = posterUrl;
  video.onloadedmetadata = () => {
    const pendingProgress = Number(video.dataset.pendingSceneProgress ?? "");
    if (!Number.isFinite(pendingProgress)) {
      return;
    }
    syncBackgroundVideoProgress(video, section, pendingProgress);
  };
  video.onloadeddata = () => {
    if (!poster) {
      return;
    }
    poster.style.opacity = "0";
    poster.style.visibility = "hidden";
  };
  video.style.cssText =
    "width:100%;height:100%;object-fit:cover;background:#000;position:absolute;inset:0;z-index:0";

  if (!existing) {
    stageRoot.appendChild(video);
  }

  if (poster) {
    const isReady = (video.readyState ?? 0) >= 2 && !sourceChanged;
    poster.style.opacity = isReady ? "0" : "1";
    poster.style.visibility = isReady ? "hidden" : "visible";
  }

  return video;
}

export function syncBackgroundVideoProgress(
  video: HTMLVideoElement | null,
  section: ProjectSectionManifest,
  progress: number,
) {
  if (!video) {
    return;
  }

  const playbackState = getBackgroundPlaybackState(section, progress, video);
  if (!playbackState) {
    video.dataset.pendingSceneProgress = String(Math.max(0, Math.min(1, progress)));
    return;
  }

  video.dataset.pendingSceneProgress = String(Math.max(0, Math.min(1, progress)));
  video.style.opacity = playbackState.visible ? "1" : "0";
  video.style.visibility = playbackState.visible ? "visible" : "hidden";
  syncBackgroundPosterVisibility(video, playbackState.visible);
  if (
    canUseNaturalBackgroundPlayback(section, video, progress) &&
    Math.abs((video.currentTime ?? 0) - playbackState.currentTime) <= NATURAL_VIDEO_DRIFT_TOLERANCE_SECONDS
  ) {
    return;
  }
  if (Math.abs((video.currentTime ?? 0) - playbackState.currentTime) > 0.04) {
    video.currentTime = playbackState.currentTime;
  }
}
