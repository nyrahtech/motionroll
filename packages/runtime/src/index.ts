
import {
  resolveFallbackStrategy,
  stepSequenceProgress,
  type AssetVariantKind,
  type FrameAsset,
  type MotionEasing,
  type OverlayDefinition,
  type ProjectManifest,
  type ProjectSectionManifest,
  type ResolvedFallbackStrategy,
  type SequenceProgressState,
} from "../../shared/src/index";
import {
  DEFAULT_SEQUENCE_SCROLL_DISTANCE,
  DEFAULT_SEQUENCE_SETTLE_EPSILON,
} from "../../shared/src/sequence";
import {
  clampProgress,
  frameIndexToSequenceProgress,
} from "../../shared/src/timing";
import {
  chooseFrameUrl,
  containerSize,
  ensureCanvas,
  getFirstFrameUrl,
  getFrameUrlForProgress,
  getSequenceRangeLocalProgress,
  isSequenceMediaVisibleAtProgress,
  preloadImage,
  renderBlankSequenceFrame,
  renderSequenceFrame,
} from "./modules/frame-controller";
import {
  applyMotionEasing,
  choosePlaybackMode,
  getOverlayAnimationState,
  getOverlayPixelPlacement,
  getSectionDurationSeconds,
  getOverlayTransform,
  getOverlayTransitionStyle,
  getStageScale,
  getTimedProgress,
} from "./modules/overlay-calc";
import {
  appendMediaElement,
  appendTextElement,
  applyOverlayCardStyles,
  applyTextStyles,
  ensureOverlayRoot,
  renderOverlayState,
  syncOverlayPresentationStyles,
} from "./modules/overlay-dom";
import {
  matchesMediaQuery,
} from "./modules/reduced-motion";
import {
  createPosterPlaceholder,
  ensureStageRoot,
  renderFallback,
  syncBackgroundVideo,
  syncBackgroundVideoProgress,
} from "./modules/stage";
import {
  type CreateScrollSectionOptions,
  type ScrollSectionController,
} from "./modules/types";
import {
  clamp,
  getActiveOverlayId,
  getFrameByIndex,
  getOverlaysInStackOrder,
  progressToFrameIndex,
} from "./utils";

const DESIGN_STAGE_WIDTH = 1440;
const DESIGN_STAGE_HEIGHT = 810;
const NATURAL_VIDEO_DRIFT_TOLERANCE_SECONDS = 0.18;
const CONTROLLED_MEDIA_PROGRESS_EPSILON = 0.0001;

function chooseSection(manifest: ProjectManifest): ProjectSectionManifest {
  const section = manifest.sections[0];
  if (!section) {
    throw new Error("Manifest must include at least one section.");
  }
  return section;
}

type MultiSectionTimelineSegment = {
  startProgress: number;
  endProgress: number;
  localStartProgress: number;
  localEndProgress: number;
};

function getControlledSectionDurationSeconds(section: ProjectSectionManifest) {
  const frameSpan = Math.max(
    section.progressMapping.frameRange.end - section.progressMapping.frameRange.start + 1,
    1,
  );
  return frameSpan / 24;
}

function buildControlledSectionSegments(
  manifest: ProjectManifest,
): MultiSectionTimelineSegment[] {
  const durations = manifest.sections.map((section) => getControlledSectionDurationSeconds(section));
  const totalDurationSeconds = durations.reduce((sum, duration) => sum + duration, 0);
  if (totalDurationSeconds <= 0) {
    return manifest.sections.map(() => ({
      startProgress: 0,
      endProgress: 1,
      localStartProgress: 0,
      localEndProgress: 1,
    }));
  }

  let cursorSeconds = 0;
  return manifest.sections.map((section, index) => {
    const durationSeconds = durations[index] ?? getControlledSectionDurationSeconds(section);
    const startSeconds = cursorSeconds;
    const endSeconds = startSeconds + durationSeconds;
    cursorSeconds = endSeconds;
    return {
      startProgress: startSeconds / totalDurationSeconds,
      endProgress: index === manifest.sections.length - 1 ? 1 : endSeconds / totalDurationSeconds,
      localStartProgress: frameIndexToSequenceProgress(
        section.progressMapping.frameRange.start,
        Math.max(section.frameCount, 1),
      ),
      localEndProgress: frameIndexToSequenceProgress(
        section.progressMapping.frameRange.end,
        Math.max(section.frameCount, 1),
      ),
    };
  });
}

function mapControlledProgressToSection(
  overallProgress: number,
  segment: MultiSectionTimelineSegment,
) {
  if (overallProgress <= segment.startProgress) {
    return segment.localStartProgress;
  }
  if (overallProgress >= segment.endProgress) {
    return segment.localEndProgress;
  }

  const span = Math.max(segment.endProgress - segment.startProgress, Number.EPSILON);
  const normalized = clampProgress((overallProgress - segment.startProgress) / span);
  return clampProgress(
    segment.localStartProgress +
      (segment.localEndProgress - segment.localStartProgress) * normalized,
  );
}

function findControlledActiveSectionIndex(
  segments: MultiSectionTimelineSegment[],
  overallProgress: number,
) {
  if (segments.length === 0) {
    return -1;
  }

  const clampedProgress = clampProgress(overallProgress);
  return segments.findIndex(
    (segment, index) =>
      clampedProgress >= segment.startProgress &&
      (clampedProgress < segment.endProgress || index === segments.length - 1),
  );
}

function createMultiSectionControlledProject(
  container: HTMLElement,
  manifest: ProjectManifest,
  options: CreateScrollSectionOptions,
): ScrollSectionController {
  const childControllers: ScrollSectionController[] = [];
  const childContainers: HTMLElement[] = [];
  let overallProgress = clampProgress(options.initialProgress ?? 0);
  let targetProgress = overallProgress;
  let overlayTransitionsEnabled = options.enableOverlayTransitions ?? false;
  let segments = buildControlledSectionSegments(manifest);
  let presentedActiveIndex = -1;
  let presentedTransitionsEnabled = overlayTransitionsEnabled;

  function destroyChildren() {
    for (const controller of childControllers.splice(0)) {
      controller.destroy();
    }
    childContainers.splice(0);
    container.replaceChildren();
  }

  function syncChildPresentation(activeIndex: number, force = false) {
    if (
      !force &&
      activeIndex === presentedActiveIndex &&
      presentedTransitionsEnabled === overlayTransitionsEnabled
    ) {
      return;
    }

    presentedActiveIndex = activeIndex;
    presentedTransitionsEnabled = overlayTransitionsEnabled;
    childControllers.forEach((controller, index) => {
      const isActive = index === activeIndex;
      childContainers[index]!.style.opacity = isActive ? "1" : "0";
      childContainers[index]!.style.visibility = isActive ? "visible" : "hidden";
      childContainers[index]!.style.pointerEvents = isActive ? "auto" : "none";
      childContainers[index]!.style.zIndex = isActive ? "1" : "0";
      controller.setOverlayTransitionsEnabled(isActive ? overlayTransitionsEnabled : false);
    });
  }

  function syncProgress(nextProgress: number, target: "current" | "target") {
    const progress = clampProgress(nextProgress);
    if (target === "target") {
      targetProgress = progress;
    } else {
      overallProgress = progress;
    }

    const referenceProgress = target === "target" ? targetProgress : overallProgress;
    const activeIndex = findControlledActiveSectionIndex(segments, referenceProgress);
    syncChildPresentation(activeIndex);

    childControllers.forEach((controller, index) => {
      const segment = segments[index];
      if (!segment) {
        return;
      }
      const localProgress = mapControlledProgressToSection(progress, segment);
      if (target === "target") {
        controller.setTargetProgress(localProgress);
      } else {
        controller.setProgress(localProgress);
      }
    });

    if (target === "current") {
      options.onProgressChange?.(progress);
    }
  }

  function buildChildren(nextManifest: ProjectManifest) {
    destroyChildren();
    segments = buildControlledSectionSegments(nextManifest);
    presentedActiveIndex = -1;

    container.style.position = "relative";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.minHeight = "0";
    container.style.overflow = "hidden";
    container.style.background = nextManifest.sections[0]?.backgroundColor ?? "#000";

    nextManifest.sections.forEach((section) => {
      const sectionContainer = document.createElement("section");
      sectionContainer.dataset.motionrollSectionId = section.id;
      sectionContainer.style.position = "absolute";
      sectionContainer.style.inset = "0";
      sectionContainer.style.width = "100%";
      sectionContainer.style.height = "100%";
      sectionContainer.style.overflow = "hidden";
      sectionContainer.style.opacity = "0";
      sectionContainer.style.visibility = "hidden";
      sectionContainer.style.pointerEvents = "none";
      container.appendChild(sectionContainer);
      childContainers.push(sectionContainer);

      childControllers.push(
        createScrollSection(
          sectionContainer,
          { ...nextManifest, sections: [section] },
          {
            ...options,
            initialProgress: frameIndexToSequenceProgress(
              section.progressMapping.frameRange.start,
              Math.max(section.frameCount, 1),
            ),
            interactionMode: "controlled",
            enableOverlayTransitions: false,
            onProgressChange: undefined,
          },
        ),
      );
    });

    syncProgress(overallProgress, "current");
    syncProgress(targetProgress, "target");
  }

  buildChildren(manifest);

  return {
    destroy() {
      destroyChildren();
    },
    refresh() {
      childControllers.forEach((controller) => controller.refresh());
    },
    setProgress(progress: number) {
      syncProgress(progress, "current");
    },
    setTargetProgress(progress: number) {
      syncProgress(progress, "target");
    },
    setOverlayTransitionsEnabled(enabled: boolean) {
      overlayTransitionsEnabled = enabled;
      syncChildPresentation(findControlledActiveSectionIndex(segments, overallProgress), true);
    },
    updateManifest(nextManifest: ProjectManifest) {
      buildChildren(nextManifest);
    },
    getProgress() {
      return overallProgress;
    },
    getTargetProgress() {
      return targetProgress;
    },
  };
}

function createMultiSectionScrollProject(
  container: HTMLElement,
  manifest: ProjectManifest,
  options: CreateScrollSectionOptions,
): ScrollSectionController {
  const childControllers: ScrollSectionController[] = [];
  let currentManifest = manifest;
  let overallProgress = clampProgress(options.initialProgress ?? 0);

  function destroyChildren() {
    for (const controller of childControllers.splice(0)) {
      controller.destroy();
    }
    container.replaceChildren();
  }

  function buildChildren(nextManifest: ProjectManifest) {
    destroyChildren();
    currentManifest = nextManifest;
    container.style.position = "relative";
    container.style.minHeight = "100vh";
    container.style.background = "#000";

    nextManifest.sections.forEach((section) => {
      const sectionContainer = document.createElement("section");
      sectionContainer.dataset.motionrollSectionId = section.id;
      sectionContainer.style.position = "relative";
      sectionContainer.style.width = "100%";
      container.appendChild(sectionContainer);
      childControllers.push(
        createScrollSection(sectionContainer, { ...nextManifest, sections: [section] }, options),
      );
    });
  }

  function syncProgress(nextProgress: number, target: "current" | "target") {
    overallProgress = clampProgress(nextProgress);
    const sectionCount = Math.max(currentManifest.sections.length, 1);
    const scaledProgress = overallProgress * sectionCount;

    childControllers.forEach((controller, index) => {
      const localProgress = clampProgress(scaledProgress - index);
      if (target === "target") {
        controller.setTargetProgress(localProgress);
      } else {
        controller.setProgress(localProgress);
      }
    });
  }

  buildChildren(manifest);

  return {
    destroy() {
      destroyChildren();
    },
    refresh() {
      childControllers.forEach((controller) => controller.refresh());
    },
    setProgress(progress: number) {
      syncProgress(progress, "current");
    },
    setTargetProgress(progress: number) {
      syncProgress(progress, "target");
    },
    setOverlayTransitionsEnabled(enabled: boolean) {
      childControllers.forEach((controller) => controller.setOverlayTransitionsEnabled(enabled));
    },
    updateManifest(nextManifest: ProjectManifest) {
      buildChildren(nextManifest);
    },
    getProgress() {
      return overallProgress;
    },
    getTargetProgress() {
      return overallProgress;
    },
  };
}

function createSequenceState(initialProgress = 0): SequenceProgressState {
  const progress = clampProgress(initialProgress);
  return {
    targetProgress: progress,
    currentProgress: progress,
  };
}

function didSequenceMediaChange(
  previousSection: ProjectSectionManifest,
  nextSection: ProjectSectionManifest,
) {
  return (
    previousSection.frameAssets !== nextSection.frameAssets ||
    previousSection.frameCount !== nextSection.frameCount ||
    previousSection.progressMapping.frameRange.start !== nextSection.progressMapping.frameRange.start ||
    previousSection.progressMapping.frameRange.end !== nextSection.progressMapping.frameRange.end ||
    previousSection.fallback.posterUrl !== nextSection.fallback.posterUrl ||
    previousSection.fallback.firstFrameUrl !== nextSection.fallback.firstFrameUrl ||
    previousSection.fallback.fallbackVideoUrl !== nextSection.fallback.fallbackVideoUrl ||
    previousSection.backgroundMedia?.url !== nextSection.backgroundMedia?.url ||
    previousSection.backgroundMedia?.previewUrl !== nextSection.backgroundMedia?.previewUrl
  );
}

export function createScrollSection(
  container: HTMLElement,
  manifest: ProjectManifest,
  options: CreateScrollSectionOptions = {},
): ScrollSectionController {
  if (manifest.sections.length > 1) {
    throw new Error(
      "Scene-based multi-section manifests are unsupported after the single-canvas refactor. Regenerate the project manifest from the current editor draft.",
    );
  }

  let section = chooseSection(manifest);
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
  let overlayTransitionsEnabled = options.enableOverlayTransitions ?? false;
  let overlayPresentationDirty = false;

  function applySectionShell(nextSection: ProjectSectionManifest) {
    container.style.position = "relative";
    container.style.height =
      interactionMode === "controlled" ? "100%" : `${nextSection.motion.sectionHeightVh}vh`;
    container.style.minHeight = interactionMode === "controlled" ? "0" : "100vh";
    container.style.overflow = interactionMode === "controlled" ? "hidden" : "visible";
    container.dataset.presetKind = nextSection.runtimeProfile.kind;
    stageRoot.style.background = nextSection.backgroundColor ?? "#000";
  }

  applySectionShell(section);

  function updateOverlayTransitionsEnabled(enabled: boolean) {
    overlayTransitionsEnabled = enabled;
    overlayRoot.dataset.overlayTransitions =
      interactionMode === "controlled" && !enabled ? "disabled" : "enabled";
    for (const overlay of section.overlays) {
      const card = overlayRoot.querySelector<HTMLElement>(`[data-overlay-id="${overlay.id}"]`);
      if (!card) continue;
      card.style.transition =
        interactionMode === "controlled" && !enabled
          ? "none"
          : getOverlayTransitionStyle(overlay);
    }
  }

  function rebuildOverlayRoot(nextSection: ProjectSectionManifest) {
    section = nextSection;
    applySectionShell(section);
    ensureOverlayRoot(
      stageRoot,
      section,
      mode,
      interactionMode,
      overlayTransitionsEnabled,
      overlayRoot,
    );
    overlayPresentationDirty = false;
  }

  function getEffectivePreloadWindow() {
    if (!isControlled) {
      return section.motion.preloadWindow;
    }

    const durationSeconds =
      typeof section.motion.durationSeconds === "number" && section.motion.durationSeconds > 0
        ? section.motion.durationSeconds
        : Math.max(section.progressMapping.frameCount, section.frameCount, 1) / 24;
    const visibleFrameCount = Math.max(
      section.progressMapping.frameRange.end - section.progressMapping.frameRange.start + 1,
      1,
    );
    const estimatedFps = Math.max(
      1,
      Math.round(visibleFrameCount / Math.max(durationSeconds, 0.1)),
    );

    return Math.min(40, Math.max(section.motion.preloadWindow, estimatedFps));
  }

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

  function getControlledMediaProgress(progress: number) {
    const normalized = clampProgress(progress);
    const localProgress =
      interactionMode === "controlled"
        ? getSequenceRangeLocalProgress(section, normalized)
        : normalized;
    return Math.min(localProgress, 1 - CONTROLLED_MEDIA_PROGRESS_EPSILON);
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

    if (overlayPresentationDirty) {
      syncOverlayPresentationStyles(overlayRoot, section, stageRoot, mode);
      overlayPresentationDirty = false;
    }

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
    if (image && lastRenderedFrameIndex !== frame.index) {
      renderSequenceFrame(canvas, image);
      posterPlaceholder?.remove();
      lastRenderedFrameIndex = frame.index;
    }

    const preloadTargets = new Set<number>();
    const effectivePreloadWindow = getEffectivePreloadWindow();
    for (let offset = 1; offset <= effectivePreloadWindow; offset += 1) {
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

  if (section.backgroundMedia?.url) {
    let backgroundVideo = syncBackgroundVideo(stageRoot, section, mode);
    let cleanupBackgroundVideoReadyHandlers: (() => void) | null = null;

    function attachBackgroundVideoReadyHandlers() {
      cleanupBackgroundVideoReadyHandlers?.();
      if (!backgroundVideo) {
        cleanupBackgroundVideoReadyHandlers = null;
        return;
      }

        const handleBackgroundVideoReady = () => {
          if (!backgroundVideo) {
            return;
          }
          syncBackgroundVideoProgress(
            backgroundVideo,
            section,
            getControlledMediaProgress(sequenceState.currentProgress),
          );
          if (
            overlayTransitionsEnabled &&
            interactionMode === "controlled" &&
          typeof backgroundVideo.play === "function"
        ) {
          void backgroundVideo.play().catch(() => undefined);
        }
      };

      backgroundVideo.addEventListener("loadedmetadata", handleBackgroundVideoReady);
      backgroundVideo.addEventListener("loadeddata", handleBackgroundVideoReady);
      cleanupBackgroundVideoReadyHandlers = () => {
        backgroundVideo?.removeEventListener("loadedmetadata", handleBackgroundVideoReady);
        backgroundVideo?.removeEventListener("loadeddata", handleBackgroundVideoReady);
      };
    }

    attachBackgroundVideoReadyHandlers();
    cleanups.push(() => cleanupBackgroundVideoReadyHandlers?.());

    function syncBackgroundVideoPlayback(enabled: boolean) {
      if (!backgroundVideo || interactionMode !== "controlled") {
        return;
      }

      backgroundVideo.dataset.motionrollPlayback = enabled ? "playing" : "paused";

        if (enabled) {
          syncBackgroundVideoProgress(
            backgroundVideo,
            section,
            getControlledMediaProgress(sequenceState.currentProgress),
          );
          if (typeof backgroundVideo.play === "function") {
            void backgroundVideo.play().catch(() => undefined);
          }
        return;
      }

        if (typeof backgroundVideo.pause === "function") {
          backgroundVideo.pause();
        }
        syncBackgroundVideoProgress(
          backgroundVideo,
          section,
          getControlledMediaProgress(sequenceState.currentProgress),
        );
      }

      function ensureControlledBackgroundPlayback() {
        if (
          !backgroundVideo ||
          interactionMode !== "controlled" ||
          !overlayTransitionsEnabled ||
          backgroundVideo.dataset.motionrollPlayback !== "playing"
        ) {
          return;
        }

        syncBackgroundVideoProgress(
          backgroundVideo,
          section,
          getControlledMediaProgress(sequenceState.currentProgress),
        );
        if (backgroundVideo.paused && typeof backgroundVideo.play === "function") {
          void backgroundVideo.play().catch(() => undefined);
        }
      }

      function renderBackgroundState(progress: number) {
        const normalized = clampProgress(progress);
        renderOverlayState(overlayRoot, section, normalized);
        syncBackgroundVideoProgress(
          backgroundVideo,
          section,
          getControlledMediaProgress(normalized),
        );
    }

    if (interactionMode === "scroll") {
      const handleScroll = () => {
        const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
        const rect = container.getBoundingClientRect();
        const availableScrollDistance = Math.max(rect.height - viewportHeight, 1);
        const nextProgress = clampProgress((-rect.top) / availableScrollDistance);
        setImmediateProgress(nextProgress);
        renderBackgroundState(nextProgress);
      };

      const handleResize = () => {
        overlayPresentationDirty = true;
        handleScroll();
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleResize);
      cleanups.push(() => window.removeEventListener("scroll", handleScroll));
      cleanups.push(() => window.removeEventListener("resize", handleResize));
      handleScroll();
    } else {
      renderBackgroundState(sequenceState.currentProgress);
    }

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
        renderBackgroundState(sequenceState.currentProgress);
      },
      setProgress(progress: number) {
        setImmediateProgress(progress);
        const normalized = clampProgress(sequenceState.currentProgress);
        renderOverlayState(overlayRoot, section, normalized);
        if (!overlayTransitionsEnabled || interactionMode !== "controlled") {
          syncBackgroundVideoProgress(
            backgroundVideo,
            section,
            getControlledMediaProgress(normalized),
          );
        } else {
          ensureControlledBackgroundPlayback();
        }
      },
      setTargetProgress(progress: number) {
        setImmediateProgress(progress);
        const normalized = clampProgress(sequenceState.currentProgress);
        renderOverlayState(overlayRoot, section, normalized);
        if (!overlayTransitionsEnabled || interactionMode !== "controlled") {
          syncBackgroundVideoProgress(
            backgroundVideo,
            section,
            getControlledMediaProgress(normalized),
          );
        } else {
          ensureControlledBackgroundPlayback();
        }
      },
      setOverlayTransitionsEnabled(enabled: boolean) {
        updateOverlayTransitionsEnabled(enabled);
        syncBackgroundVideoPlayback(enabled);
      },
      updateManifest(nextManifest: ProjectManifest) {
        rebuildOverlayRoot(chooseSection(nextManifest));
          backgroundVideo = syncBackgroundVideo(stageRoot, section, mode);
        attachBackgroundVideoReadyHandlers();
        renderBackgroundState(sequenceState.currentProgress);
        syncBackgroundVideoPlayback(overlayTransitionsEnabled);
      },
      getProgress() {
        return sequenceState.currentProgress;
      },
      getTargetProgress() {
        return sequenceState.targetProgress;
      },
    };
  }

  if (fallback !== "sequence") {
    const fallbackResult = renderFallback(stageRoot, section, mode, fallback, interactionMode);
    const fallbackVideo = fallbackResult.video;
    const fallbackElement = fallbackResult.element;
    const fallbackDurationSeconds = getSectionDurationSeconds(section);
    cleanups.push(fallbackResult.cleanup);

    function syncFallbackVideo(progress: number) {
      if (!fallbackVideo || fallback !== "video") {
        return;
      }
      const nextTime = getControlledMediaProgress(progress) * fallbackDurationSeconds;
      const currentTime =
        typeof fallbackVideo.currentTime === "number" ? fallbackVideo.currentTime : 0;
      const canUseNaturalPlayback =
        fallbackVideo.dataset.motionrollPlayback === "playing" &&
        Math.abs(fallbackDurationSeconds - (fallbackVideo.duration ?? 0)) <= NATURAL_VIDEO_DRIFT_TOLERANCE_SECONDS;
      if (
        canUseNaturalPlayback &&
        Math.abs(currentTime - nextTime) <= NATURAL_VIDEO_DRIFT_TOLERANCE_SECONDS
      ) {
        return;
      }
      if (Math.abs(currentTime - nextTime) > 0.05) {
        fallbackVideo.currentTime = nextTime;
      }
    }

    if (fallbackVideo && fallback === "video") {
      fallbackVideo.dataset.motionrollPlayback = "paused";
      const handleFallbackVideoReady = () => {
        syncFallbackVideo(sequenceState.currentProgress);
        if (overlayTransitionsEnabled && interactionMode === "controlled" && typeof fallbackVideo.play === "function") {
          void fallbackVideo.play().catch(() => undefined);
        }
      };
      fallbackVideo.addEventListener("loadedmetadata", handleFallbackVideoReady);
      fallbackVideo.addEventListener("loadeddata", handleFallbackVideoReady);
      cleanups.push(() => {
        fallbackVideo.removeEventListener("loadedmetadata", handleFallbackVideoReady);
        fallbackVideo.removeEventListener("loadeddata", handleFallbackVideoReady);
      });
    }

    renderOverlayState(overlayRoot, section, 0);
    syncFallbackVideo(sequenceState.currentProgress);

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
        syncFallbackVideo(sequenceState.currentProgress);
      },
      setProgress(progress: number) {
        setImmediateProgress(progress);
        renderOverlayState(overlayRoot, section, sequenceState.currentProgress);
        if (!overlayTransitionsEnabled || interactionMode !== "controlled") {
          syncFallbackVideo(sequenceState.currentProgress);
        }
      },
      setTargetProgress(progress: number) {
        setImmediateProgress(progress);
        renderOverlayState(overlayRoot, section, sequenceState.currentProgress);
        if (!overlayTransitionsEnabled || interactionMode !== "controlled") {
          syncFallbackVideo(sequenceState.currentProgress);
        }
      },
      setOverlayTransitionsEnabled(enabled: boolean) {
        updateOverlayTransitionsEnabled(enabled);
        if (fallbackVideo && fallback === "video" && interactionMode === "controlled") {
          if (enabled) {
            fallbackVideo.dataset.motionrollPlayback = "playing";
            syncFallbackVideo(sequenceState.currentProgress);
            if (typeof fallbackVideo.play === "function") {
              void fallbackVideo.play().catch(() => undefined);
            }
          } else {
            fallbackVideo.dataset.motionrollPlayback = "paused";
            if (typeof fallbackVideo.pause === "function") {
              fallbackVideo.pause();
            }
            syncFallbackVideo(sequenceState.currentProgress);
          }
        }
      },
      updateManifest(nextManifest: ProjectManifest) {
        rebuildOverlayRoot(chooseSection(nextManifest));
        renderOverlayState(overlayRoot, section, sequenceState.currentProgress);
        syncFallbackVideo(sequenceState.currentProgress);
      },
      getProgress() {
        return sequenceState.currentProgress;
      },
      getTargetProgress() {
        return sequenceState.targetProgress;
      },
    };
  }

  let posterPlaceholder = createPosterPlaceholder(
    stageRoot,
    section,
    mode,
    sequenceState.currentProgress,
  );
  const canvas = ensureCanvas(stageRoot, options.canvas);
  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          overlayPresentationDirty = true;
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
      overlayPresentationDirty = true;
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
      overlayPresentationDirty = true;
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
    setOverlayTransitionsEnabled(enabled: boolean) {
      updateOverlayTransitionsEnabled(enabled);
    },
    updateManifest(nextManifest: ProjectManifest) {
      const nextSection = chooseSection(nextManifest);
      const mediaChanged = didSequenceMediaChange(section, nextSection);
      rebuildOverlayRoot(nextSection);
      if (mediaChanged) {
        frameCache.clear();
        framePromiseCache.clear();
        latestRequestedFrameIndex = null;
        lastRenderedFrameIndex = null;
        posterPlaceholder?.remove();
        posterPlaceholder = createPosterPlaceholder(
          stageRoot,
          section,
          mode,
          sequenceState.currentProgress,
        );
      }
      overlayPresentationDirty = false;
      void renderForProgress(sequenceState.currentProgress);
    },
    getProgress() {
      return sequenceState.currentProgress;
    },
    getTargetProgress() {
      return sequenceState.targetProgress;
    },
  };
}

export type { CreateScrollSectionOptions, ScrollSectionController } from "./modules/types";
export { getActiveOverlayId, getFrameByIndex, getOverlaysInStackOrder, progressToFrameIndex } from "./utils";

// Module re-exports — consumers can use these without importing createScrollSection
export {
  chooseFrameUrl,
  ensureCanvas,
  getFirstFrameUrl,
  getFrameUrlForProgress,
  getSequenceRangeLocalProgress,
  isSequenceMediaVisibleAtProgress,
  preloadImage,
  renderBlankSequenceFrame,
  renderSequenceFrame,
} from "./modules/frame-controller";

export { attachScrollObserver } from "./modules/scroll-observer";
export { ensureStageRoot, createPosterPlaceholder, renderFallback } from "./modules/stage";
export {
  choosePlaybackMode, getOverlayAnimationState, getOverlayPixelPlacement,
  getOverlayTransform, getOverlayTransitionStyle, getStageScale,
  getTimedProgress, hexToRgbTuple, mix, withOpacity,
} from "./modules/overlay-calc";
export {
  appendMediaElement, appendTextElement, applyOverlayCardStyles,
  applyTextStyles, ensureOverlayRoot, renderOverlayState, syncOverlayPresentationStyles,
} from "./modules/overlay-dom";
export {
  resolveOverlayBlendModeCssValue,
  resolveOverlayMediaKind,
  supportsPlusLighterBlendMode,
} from "./modules/overlay-media";
export { matchesMediaQuery, prefersReducedMotion, watchReducedMotion } from "./modules/reduced-motion";
export { assertManifestSection, fetchManifest } from "./modules/manifest-loader";
