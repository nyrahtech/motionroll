import type { ProjectSectionManifest, SectionTransition } from "../../../shared/src/index";
import { clampProgress, frameIndexToSequenceProgress } from "../../../shared/src/timing";
import { getFirstFrameUrl } from "./frame-controller";
import { getSectionDurationSeconds, mix } from "./overlay-calc";

const SCENE_TRANSITION_LAYER_ATTR = "sceneTransitionLayer";
const SCENE_TRANSITION_LAYER_SELECTOR = '[data-scene-transition-layer="true"]';

type SceneTransitionMediaRefs = {
  stageRoot: HTMLElement;
  canvas?: HTMLCanvasElement | null;
  mediaElement?: HTMLElement | null;
  posterPlaceholder?: HTMLImageElement | null;
};

type SequenceTransitionPhase = "enter" | "exit";

function getSequenceTransition(
  section: ProjectSectionManifest,
  phase: SequenceTransitionPhase,
): SectionTransition | null {
  return (
    section.transitions.find(
      (transition) =>
        transition.scope === "sequence" && (transition.phase ?? "enter") === phase,
    ) ?? null
  );
}

function getSceneTransitionWindow(
  section: ProjectSectionManifest,
  transition: SectionTransition,
) {
  const frameCount = Math.max(section.frameCount, 1);
  const rangeStart = frameIndexToSequenceProgress(
    section.progressMapping.frameRange.start,
    frameCount,
  );
  const rangeEnd = frameIndexToSequenceProgress(
    section.progressMapping.frameRange.end,
    frameCount,
  );
  const clipDuration = Math.max(rangeEnd - rangeStart, 0.0001);
  const duration = Math.max(
    0.0001,
    Math.min(
      transition.duration / Math.max(getSectionDurationSeconds(section), 0.0001),
      clipDuration,
    ),
  );
  const phase = transition.phase ?? "enter";

  return phase === "enter"
    ? {
        phase,
        start: rangeStart,
        end: Math.min(rangeEnd, rangeStart + duration),
      }
    : {
        phase,
        start: Math.max(rangeStart, rangeEnd - duration),
        end: rangeEnd,
      };
}

function getSceneTransitionSource(
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
) {
  return (
    section.fallback.posterUrl ??
    section.fallback.firstFrameUrl ??
    getFirstFrameUrl(section, mode) ??
    ""
  );
}

function formatOpacity(value: number) {
  return Number(value.toFixed(4)).toString();
}

function formatScale(value: number) {
  return Number(value.toFixed(4)).toString();
}

function formatBlur(value: number) {
  return `${Number(value.toFixed(3))}px`;
}

function clearSceneTransitionStyles(element: HTMLElement) {
  element.style.opacity = "";
  element.style.transform = "";
  element.style.filter = "";
  element.style.clipPath = "";
  element.style.transformOrigin = "";
  element.style.willChange = "";
}

function getMediaElements(refs: SceneTransitionMediaRefs) {
  const mediaElements = new Set<HTMLElement>();
  if (refs.canvas) mediaElements.add(refs.canvas);
  if (refs.mediaElement) mediaElements.add(refs.mediaElement);
  if (refs.posterPlaceholder) mediaElements.add(refs.posterPlaceholder);
  return [...mediaElements];
}

function getSceneTransitionLayer(stageRoot: HTMLElement) {
  return stageRoot.querySelector<HTMLElement>(SCENE_TRANSITION_LAYER_SELECTOR);
}

function removeSceneTransitionLayer(stageRoot: HTMLElement) {
  getSceneTransitionLayer(stageRoot)?.remove();
}

function ensureSceneTransitionLayer(stageRoot: HTMLElement, source: string) {
  let layer = getSceneTransitionLayer(stageRoot);
  if (!source) {
    layer?.remove();
    return null;
  }

  if (!layer) {
    layer = document.createElement("img");
    layer.dataset[SCENE_TRANSITION_LAYER_ATTR] = "true";
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.width = "100%";
    layer.style.height = "100%";
    layer.style.objectFit = "cover";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "12";
    stageRoot.appendChild(layer);
  }

  if ((layer as HTMLImageElement).src !== source) {
    (layer as HTMLImageElement).src = source;
  }

  return layer;
}

function setMediaRestingState(
  elements: HTMLElement[],
  transition: SectionTransition,
  phase: SequenceTransitionPhase,
) {
  for (const element of elements) {
    clearSceneTransitionStyles(element);

    if (transition.preset === "wipe") {
      element.style.clipPath =
        phase === "enter" ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)";
      element.style.opacity = "1";
      continue;
    }

    element.style.opacity = "0";
  }
}

function applyActiveTransition(
  elements: HTMLElement[],
  refs: SceneTransitionMediaRefs,
  transition: SectionTransition,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  localProgress: number,
) {
  const phase = transition.phase ?? "enter";
  const source = getSceneTransitionSource(section, mode);
  const transitionLayerNeeded = transition.preset === "crossfade" && phase === "enter";
  const transitionLayer = transitionLayerNeeded
    ? ensureSceneTransitionLayer(refs.stageRoot, source)
    : null;

  if (!transitionLayerNeeded) {
    removeSceneTransitionLayer(refs.stageRoot);
  }

  for (const element of elements) {
    element.style.transformOrigin = "center center";
    element.style.willChange = "opacity, transform, filter, clip-path";

    switch (transition.preset) {
      case "fade":
      case "crossfade":
        element.style.opacity =
          phase === "enter"
            ? formatOpacity(localProgress)
            : formatOpacity(1 - localProgress);
        element.style.transform = "";
        element.style.filter = "";
        element.style.clipPath = "";
        break;
      case "wipe":
        element.style.opacity = "1";
        element.style.transform = "";
        element.style.filter = "";
        element.style.clipPath =
          phase === "enter"
            ? `inset(0 ${Number(((1 - localProgress) * 100).toFixed(3))}% 0 0)`
            : `inset(0 0 0 ${Number((localProgress * 100).toFixed(3))}%)`;
        break;
      case "zoom-dissolve":
        element.style.opacity =
          phase === "enter"
            ? formatOpacity(mix(0.16, 1, localProgress))
            : formatOpacity(mix(1, 0.16, localProgress));
        element.style.transform = `scale(${formatScale(
          phase === "enter"
            ? mix(1.08, 1, localProgress)
            : mix(1, 1.08, localProgress),
        )})`;
        element.style.filter = `blur(${formatBlur(
          phase === "enter"
            ? mix(8, 0, localProgress)
            : mix(0, 8, localProgress),
        )})`;
        element.style.clipPath = "";
        break;
      case "blur-dissolve":
        element.style.opacity =
          phase === "enter"
            ? formatOpacity(mix(0.2, 1, localProgress))
            : formatOpacity(mix(1, 0.2, localProgress));
        element.style.transform = "";
        element.style.filter = `blur(${formatBlur(
          phase === "enter"
            ? mix(18, 0, localProgress)
            : mix(0, 18, localProgress),
        )})`;
        element.style.clipPath = "";
        break;
    }
  }

  if (transitionLayer) {
    transitionLayer.style.willChange = "opacity, clip-path, filter, transform";
    transitionLayer.style.transformOrigin = "center center";
    transitionLayer.style.opacity = formatOpacity(1 - localProgress);
    transitionLayer.style.clipPath = "";
    transitionLayer.style.filter = `blur(${formatBlur(mix(0, 4, localProgress))})`;
    transitionLayer.style.transform = `scale(${formatScale(mix(1, 1.03, localProgress))})`;
  }
}

export function syncSceneTransition(
  refs: SceneTransitionMediaRefs,
  section: ProjectSectionManifest,
  mode: "desktop" | "mobile",
  progress: number,
) {
  const mediaElements = getMediaElements(refs);
  const enterTransition = getSequenceTransition(section, "enter");
  const exitTransition = getSequenceTransition(section, "exit");
  const enterWindow = enterTransition ? getSceneTransitionWindow(section, enterTransition) : null;
  const exitWindow = exitTransition ? getSceneTransitionWindow(section, exitTransition) : null;

  if (!enterTransition && !exitTransition) {
    for (const element of mediaElements) {
      clearSceneTransitionStyles(element);
    }
    removeSceneTransitionLayer(refs.stageRoot);
    return;
  }

  const activeEnter =
    enterTransition &&
    enterWindow &&
    progress >= enterWindow.start &&
    progress < enterWindow.end;
  const activeExit =
    exitTransition &&
    exitWindow &&
    progress >= exitWindow.start &&
    progress <= exitWindow.end;

  if (activeEnter && enterWindow && enterTransition) {
    const localProgress = clampProgress(
      (progress - enterWindow.start) / Math.max(enterWindow.end - enterWindow.start, 0.0001),
    );
    applyActiveTransition(mediaElements, refs, enterTransition, section, mode, localProgress);
    return;
  }

  if (activeExit && exitWindow && exitTransition) {
    const localProgress = clampProgress(
      (progress - exitWindow.start) / Math.max(exitWindow.end - exitWindow.start, 0.0001),
    );
    applyActiveTransition(mediaElements, refs, exitTransition, section, mode, localProgress);
    return;
  }

  if (enterTransition && enterWindow && progress < enterWindow.start) {
    setMediaRestingState(mediaElements, enterTransition, "enter");
    if (enterTransition.preset === "crossfade") {
      const layer = ensureSceneTransitionLayer(
        refs.stageRoot,
        getSceneTransitionSource(section, mode),
      );
      if (layer) {
        layer.style.opacity = "1";
        layer.style.clipPath = "";
        layer.style.filter = "";
        layer.style.transform = "";
      }
    } else {
      removeSceneTransitionLayer(refs.stageRoot);
    }
    return;
  }

  if (exitTransition && exitWindow && progress > exitWindow.end) {
    setMediaRestingState(mediaElements, exitTransition, "exit");
    removeSceneTransitionLayer(refs.stageRoot);
    return;
  }

  for (const element of mediaElements) {
    clearSceneTransitionStyles(element);
  }
  removeSceneTransitionLayer(refs.stageRoot);
}
