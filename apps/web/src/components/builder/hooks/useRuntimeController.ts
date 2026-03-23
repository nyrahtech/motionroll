/**
 * useRuntimeController — owns the ScrollSectionController lifecycle.
 *
 * Handles:
 * - Full runtime restart when structural manifest properties change (restartKey)
 * - Scroll-mode runtime for non-controlled previews
 * - Playhead sync from React state → controller
 * - Auto-deselect when playhead leaves the selected overlay's timing window
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import {
  createScrollSection,
  type ScrollSectionController,
} from "@motionroll/runtime";

export type UseRuntimeControllerOptions = {
  manifest: ProjectManifest;
  renderManifest: ProjectManifest;
  restartKey: string;
  mode: "desktop" | "mobile";
  isPlaying: boolean;
  isControlledRuntime: boolean;
  hasRenderableMedia: boolean;
  playheadProgress?: number;
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
  playheadProgress,
  selectedOverlayId,
  mountNodeRef,
  onPlayheadChange,
  onSelectOverlay,
  scheduleWireInteractivity,
}: UseRuntimeControllerOptions) {
  const controllerRef = useRef<ScrollSectionController | null>(null);
  const lastInternalProgressRef = useRef<number | null>(null);
  const onPlayheadChangeRef = useRef(onPlayheadChange);

  // Keep onPlayheadChange ref fresh
  useEffect(() => {
    onPlayheadChangeRef.current = onPlayheadChange;
  }, [onPlayheadChange]);

  // ── Heavy effect: full runtime restart ───────────────────────────────────
  // Intentionally depends on restartKey, NOT renderManifest.
  // Overlay-only manifest changes (style, text, layout) never trigger a restart.
  useEffect(() => {
    if (!isControlledRuntime || !hasRenderableMedia) return;
    const node = mountNodeRef.current;
    if (!node) return;

    controllerRef.current?.destroy();
    node.replaceChildren();

    controllerRef.current = createScrollSection(node, renderManifest, {
      initialProgress: playheadProgress ?? 0,
      mode,
      interactionMode: "controlled",
      allowWheelScrub: false,
      enableOverlayTransitions: isPlaying,
      onProgressChange: (progress) => {
        lastInternalProgressRef.current = progress;
        onPlayheadChangeRef.current?.(progress);
      },
    });

    if (typeof playheadProgress === "number") {
      controllerRef.current.setProgress(playheadProgress);
    }
    scheduleWireInteractivity();

    return () => {
      controllerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  // ── Scroll-mode runtime ───────────────────────────────────────────────────
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

  // ── Playhead sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isControlledRuntime || typeof playheadProgress !== "number") return;

    if (
      lastInternalProgressRef.current !== null &&
      Math.abs(lastInternalProgressRef.current - playheadProgress) <= 0.001
    ) {
      lastInternalProgressRef.current = null;
      return;
    }

    controllerRef.current?.setProgress(playheadProgress);
  }, [playheadProgress, isControlledRuntime]);

  // ── Auto-deselect ─────────────────────────────────────────────────────────
  const selectedOverlay = renderManifest.sections[0]?.overlays.find(
    (o) => o.id === selectedOverlayId,
  );

  useEffect(() => {
    if (!isControlledRuntime || typeof playheadProgress !== "number") return;
    if (!selectedOverlay) return;
    const { start, end } = selectedOverlay.timing;
    const active = playheadProgress >= start && playheadProgress < end + 0.0001;
    if (!active) onSelectOverlay?.("");
  }, [playheadProgress, selectedOverlay, isControlledRuntime, onSelectOverlay]);

  return { controllerRef, lastInternalProgressRef };
}
