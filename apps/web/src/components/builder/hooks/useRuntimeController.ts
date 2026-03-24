/**
 * useRuntimeController - owns the ScrollSectionController lifecycle.
 *
 * Handles:
 * - Full runtime restart when structural manifest properties change (restartKey)
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
  manifest: ProjectManifest;
  renderManifest: ProjectManifest;
  restartKey: string;
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
  restartKey,
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

  // Heavy effect: full runtime restart.
  // Intentionally depends on restartKey, not renderManifest.
  useEffect(() => {
    if (!isControlledRuntime || !hasRenderableMedia) return;
    const node = mountNodeRef.current;
    if (!node) return;

    controllerRef.current?.destroy();
    node.replaceChildren();

    controllerRef.current = createScrollSection(node, renderManifest, {
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
    scheduleWireInteractivity();

    return () => {
      controllerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  useEffect(() => {
    if (!isControlledRuntime || !hasRenderableMedia) return;
    controllerRef.current?.updateManifest(renderManifest);
    scheduleWireInteractivity();
  }, [renderManifest, hasRenderableMedia, isControlledRuntime, scheduleWireInteractivity]);

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

    return () => controllerRef.current?.destroy();
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

      const selectedOverlay = renderManifestRef.current.sections[0]?.overlays.find(
        (overlay) => overlay.id === selectedOverlayIdRef.current,
      );
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
