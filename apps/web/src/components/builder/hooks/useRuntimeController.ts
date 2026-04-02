/**
 * useRuntimeController - owns the ScrollSectionController lifecycle.
 *
 * Handles:
 * - Stable controlled runtime creation for preview playback
 * - Scroll-mode runtime for non-controlled previews
 * - Playhead sync from the playback controller to the runtime
 * - Auto-deselect when playback leaves the selected overlay's timing window
 */
"use client";

import { useEffect, useRef } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import {
  createScrollSection,
  type ScrollSectionController,
} from "@motionroll/runtime";
import type { EditorPlaybackController } from "./useEditorPlayback";

export type UseRuntimeControllerOptions = {
  renderManifest: ProjectManifest;
  mode: "desktop" | "mobile";
  isPlaying: boolean;
  isControlledRuntime: boolean;
  hasRenderableMedia: boolean;
  playback?: EditorPlaybackController;
  selectedOverlayId?: string;
  mountNodeRef: React.MutableRefObject<HTMLDivElement | null>;
  onPlayheadChange?: (progress: number) => void;
  onSelectOverlay?: (overlayId: string) => void;
  scheduleWireInteractivity: () => void;
};

export function useRuntimeController({
  renderManifest,
  mode,
  isPlaying,
  isControlledRuntime,
  hasRenderableMedia,
  playback,
  selectedOverlayId,
  mountNodeRef,
  onPlayheadChange,
  onSelectOverlay,
  scheduleWireInteractivity,
}: UseRuntimeControllerOptions) {
  const controllerRef = useRef<ScrollSectionController | null>(null);
  const lastInternalProgressRef = useRef<number | null>(null);
  const onPlayheadChangeRef = useRef(onPlayheadChange);
  const renderManifestRef = useRef(renderManifest);
  const selectedOverlayIdRef = useRef(selectedOverlayId);
  const isPlayingRef = useRef(isPlaying);
  const onSelectOverlayRef = useRef(onSelectOverlay);
  const scheduleWireInteractivityRef = useRef(scheduleWireInteractivity);

  useEffect(() => {
    onPlayheadChangeRef.current = onPlayheadChange;
  }, [onPlayheadChange]);

  useEffect(() => {
    renderManifestRef.current = renderManifest;
  }, [renderManifest]);

  useEffect(() => {
    selectedOverlayIdRef.current = selectedOverlayId;
  }, [selectedOverlayId]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    onSelectOverlayRef.current = onSelectOverlay;
  }, [onSelectOverlay]);

  useEffect(() => {
    scheduleWireInteractivityRef.current = scheduleWireInteractivity;
  }, [scheduleWireInteractivity]);

  useEffect(() => {
    if (!isControlledRuntime || hasRenderableMedia) {
      return;
    }
    const node = mountNodeRef.current;
    controllerRef.current?.destroy();
    controllerRef.current = null;
    lastInternalProgressRef.current = null;
    node?.replaceChildren();
  }, [hasRenderableMedia, isControlledRuntime, mountNodeRef]);

  useEffect(() => {
    if (!isControlledRuntime || !hasRenderableMedia) return;
    const node = mountNodeRef.current;
    if (!node) return;

    controllerRef.current?.destroy();
    node.replaceChildren();

    controllerRef.current = createScrollSection(node, renderManifestRef.current, {
      initialProgress: playback?.getPlayhead() ?? 0,
      mode,
      interactionMode: "controlled",
      allowWheelScrub: false,
      enableOverlayTransitions: isPlaying,
      onProgressChange: (progress) => {
        lastInternalProgressRef.current = progress;
        onPlayheadChangeRef.current?.(progress);
      },
    });
    controllerRef.current.setOverlayTransitionsEnabled(isPlaying);
    controllerRef.current.setProgress(playback?.getPlayhead() ?? 0);
    scheduleWireInteractivityRef.current();

    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [
    hasRenderableMedia,
    isControlledRuntime,
    mode,
    mountNodeRef,
  ]);

  useEffect(() => {
    if (!isControlledRuntime || !hasRenderableMedia) return;
    controllerRef.current?.updateManifest(renderManifest);
    scheduleWireInteractivityRef.current();
  }, [renderManifest, hasRenderableMedia, isControlledRuntime]);

  useEffect(() => {
    if (isControlledRuntime || !hasRenderableMedia) return;
    const node = mountNodeRef.current;
    if (!node) return;

    controllerRef.current?.destroy();
    node.replaceChildren();
    controllerRef.current = createScrollSection(node, renderManifest, {
      mode,
      interactionMode: "scroll",
      allowWheelScrub: false,
    });

    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [hasRenderableMedia, isControlledRuntime, mode, renderManifest, mountNodeRef]);

  useEffect(() => {
    if (!isControlledRuntime) return;
    controllerRef.current?.setOverlayTransitionsEnabled(isPlaying);
  }, [isControlledRuntime, isPlaying]);

  useEffect(() => {
    if (!isControlledRuntime || !playback) return;

    const syncPlayhead = () => {
      const playheadProgress = playback.getPlayhead();

      if (
        lastInternalProgressRef.current !== null &&
        Math.abs(lastInternalProgressRef.current - playheadProgress) <= 0.001
      ) {
        lastInternalProgressRef.current = null;
      } else {
        controllerRef.current?.setProgress(playheadProgress);
      }

      const selectedOverlay = renderManifestRef.current.sections
        .flatMap((section) => section.overlays)
        .find((overlay) => overlay.id === selectedOverlayIdRef.current);
      if (!selectedOverlay || !isPlayingRef.current) {
        return;
      }

      const { start, end } = selectedOverlay.timing;
      const active = playheadProgress >= start && playheadProgress < end + 0.0001;
      if (!active) {
        onSelectOverlayRef.current?.("");
      }
    };

    syncPlayhead();
    return playback.subscribe(syncPlayhead);
  }, [playback, isControlledRuntime]);

  return { controllerRef, lastInternalProgressRef };
}
