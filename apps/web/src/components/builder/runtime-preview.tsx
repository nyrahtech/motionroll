"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OverlayManipulator } from "./overlay-manipulator";
import type { EditorPlaybackController } from "./hooks/useEditorPlayback";
import { useRuntimeController } from "./hooks/useRuntimeController";
import {
  applyManifestOverlayStyles,
  getManifestSection,
  getSectionMediaSignature,
  hasRenderableCanvasContent,
  hasRenderableSectionContent,
} from "./runtime-preview-utils";

type RuntimePreviewProps = {
  manifest: ProjectManifest;
  mode?: "desktop" | "mobile";
  standalone?: boolean;
  isPlaying?: boolean;
  playback?: EditorPlaybackController;
  onPlayheadChange?: (progress: number) => void;
  onModeChange?: (mode: "desktop" | "mobile") => void;
  onPlayToggle?: () => void;
  onSelectOverlay?: (overlayId: string, options?: { additive?: boolean }) => void;
  onOverlayLayoutChange?: (
    overlayId: string,
    layout: Partial<{ x: number; y: number; width: number; height: number }>,
    options?: {
      intent?: "move" | "resize";
      scaleX?: number;
      scaleY?: number;
      styleChanges?: Record<string, unknown>;
      backgroundChanges?: Record<string, unknown>;
    },
  ) => void;
  onInlineTextChange?: (
    overlayId: string,
    field: "text",
    value: string,
    htmlValue?: string,
  ) => void;
  onOverlayStyleLiveChange?: (overlayId: string, changes: Record<string, unknown>) => void;
  onOverlayStyleChange?: (overlayId: string, changes: Record<string, unknown>) => void;
  onDuplicateOverlay?: (overlayId: string) => void;
  onDeleteOverlay?: (overlayId: string) => void;
  selectedOverlayId?: string;
  selectedOverlayIds?: string[];
  canGroupSelection?: boolean;
  canUngroupSelection?: boolean;
  showControls?: boolean;
  className?: string;
  stageClassName?: string;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onMoveSelection?: (delta: { x: number; y: number }) => void;
  onDuplicateSelection?: () => void;
  onDeleteSelection?: () => void;
};

export function RuntimePreview({
  manifest,
  mode: controlledMode,
  standalone = false,
  isPlaying = false,
  playback,
  onPlayheadChange,
  onModeChange,
  onPlayToggle,
  onSelectOverlay,
  onOverlayLayoutChange,
  onInlineTextChange,
  onOverlayStyleLiveChange,
  onOverlayStyleChange,
  onDuplicateOverlay,
  onDeleteOverlay,
  selectedOverlayId,
  selectedOverlayIds,
  canGroupSelection = false,
  canUngroupSelection = false,
  showControls = true,
  className,
  stageClassName,
  onGroupSelection,
  onUngroupSelection,
  onMoveSelection,
  onDuplicateSelection,
  onDeleteSelection,
}: RuntimePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountNodeRef = useRef<HTMLDivElement | null>(null);

  const isInteractingRef = useRef(false);
  const pendingManifestRef = useRef<ProjectManifest | null>(null);
  const latestManifestRef = useRef(manifest);
  const renderManifestRef = useRef(manifest);
  const interactionSyncRafRef = useRef<number | null>(null);
  const syncRafRef = useRef<number | null>(null);
  const pendingSyncManifestRef = useRef<ProjectManifest | null>(null);

  const [internalMode, setInternalMode] = useState<"desktop" | "mobile">("desktop");
  const [renderManifest, setRenderManifest] = useState(manifest);

  latestManifestRef.current = manifest;
  const renderSection = getManifestSection(renderManifest);
  const latestSection = getManifestSection(manifest);
  const effectiveRenderManifest =
    renderSection?.id !== latestSection?.id ||
    getSectionMediaSignature(renderSection) !== getSectionMediaSignature(latestSection)
      ? manifest
      : renderManifest;
  renderManifestRef.current = effectiveRenderManifest;

  const mode = controlledMode ?? internalMode;
  const isControlledRuntime = Boolean(playback);
  const section = getManifestSection(effectiveRenderManifest);
  const hasRenderableMedia =
    hasRenderableCanvasContent(manifest) ||
    manifest.sections.some((candidate) => hasRenderableSectionContent(candidate));
  const emptyCanvasBackground =
    isControlledRuntime && !hasRenderableMedia
      ? section?.backgroundColor ?? "var(--panel-bg-preview)"
      : undefined;

  const selectedOverlay = useMemo(
    () => latestSection?.overlays.find((overlay: { id: string }) => overlay.id === selectedOverlayId),
    [latestSection?.overlays, selectedOverlayId],
  );
  const selectedStyle = selectedOverlay?.content.style;
  const isSelectedText =
    selectedOverlay?.content.type === "text" ||
    (!selectedOverlay?.content.type && Boolean(selectedOverlay));

  function setInteracting(active: boolean) {
    isInteractingRef.current = active;
    if (interactionSyncRafRef.current !== null) {
      cancelAnimationFrame(interactionSyncRafRef.current);
      interactionSyncRafRef.current = null;
    }
    if (!active) {
      pendingManifestRef.current = null;
      interactionSyncRafRef.current = requestAnimationFrame(() => {
        interactionSyncRafRef.current = null;
        if (isInteractingRef.current) {
          return;
        }
        const next = latestManifestRef.current;
        if (renderManifestRef.current !== next) {
          setRenderManifest(next);
        }
      });
    }
  }

  useEffect(() => {
    if (isInteractingRef.current) {
      pendingManifestRef.current = manifest;
      return;
    }
    if (renderManifest !== manifest) {
      setRenderManifest(manifest);
    }
  }, [manifest, renderManifest]);

  useEffect(() => () => {
    if (interactionSyncRafRef.current !== null) {
      cancelAnimationFrame(interactionSyncRafRef.current);
      interactionSyncRafRef.current = null;
    }
  }, []);

  function wireOverlayInteractivity() {
    const container = containerRef.current;
    if (!container) return;
    const root = container.querySelector(".motionroll-overlay-root");
    if (!(root instanceof HTMLElement)) return;

    for (const child of Array.from(root.querySelectorAll<HTMLElement>("[data-overlay-id]"))) {
      const overlayId = child.dataset.overlayId;
      if (!overlayId) continue;

      child.onclick = (event) => {
        if (child.dataset.state !== "active") return;
        event.preventDefault();
        event.stopPropagation();
        onSelectOverlay?.(overlayId, {
          additive: (event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey,
        });
      };
      child.style.cursor = child.dataset.state === "active" ? "pointer" : "";

      const actionLink = child.querySelector<HTMLAnchorElement>("[data-overlay-action-link='true'], a");
      if (actionLink) {
        actionLink.style.cursor = "pointer";
        actionLink.onmouseenter = () => {
          actionLink.style.opacity = "0.92";
          actionLink.style.transform = "translate3d(0, -1px, 0)";
          actionLink.style.boxShadow = "0 8px 24px rgba(0,0,0,0.16)";
        };
        actionLink.onmouseleave = () => {
          actionLink.style.opacity = "1";
          actionLink.style.transform = "translate3d(0, 0, 0)";
          actionLink.style.boxShadow = "";
        };
        actionLink.onmousedown = () => {
          actionLink.style.opacity = "0.84";
          actionLink.style.transform = "translate3d(0, 0, 0)";
        };
        actionLink.onmouseup = () => {
          actionLink.style.opacity = "0.92";
          actionLink.style.transform = "translate3d(0, -1px, 0)";
        };
      }

      const isSelected = overlayId === selectedOverlayId;
      const isActive = child.dataset.state === "active";

      for (const field of Array.from(child.querySelectorAll<HTMLElement>("[data-text-field]"))) {
        const name = field.dataset.textField as "text" | undefined;
        const editable = isSelected && isActive && name === "text";
        field.spellcheck = false;
        field.contentEditable = editable ? "true" : "false";
        if (editable && name) {
          field.onblur = () =>
            onInlineTextChange?.(overlayId, name, field.textContent ?? "", field.innerHTML);
        } else {
          field.onblur = null;
        }
      }
    }
  }

  function scheduleWireInteractivity() {
    wireOverlayInteractivity();
  }

  useEffect(() => {
    if (!isControlledRuntime) return;
    scheduleWireInteractivity();
  }, [selectedOverlayId, effectiveRenderManifest, isControlledRuntime]);

  const { controllerRef } = useRuntimeController({
    renderManifest: effectiveRenderManifest,
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
  });

  useEffect(() => {
    if (!isControlledRuntime || !controllerRef.current) return;

    pendingSyncManifestRef.current = effectiveRenderManifest;

    if (syncRafRef.current !== null) {
      return;
    }

    syncRafRef.current = requestAnimationFrame(() => {
      syncRafRef.current = null;
      const nextManifest = pendingSyncManifestRef.current;
      pendingSyncManifestRef.current = null;
      if (!nextManifest || !controllerRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      applyManifestOverlayStyles(
        nextManifest,
        container,
        scheduleWireInteractivity,
      );
    });

    return () => {
      if (syncRafRef.current !== null) {
        cancelAnimationFrame(syncRafRef.current);
        syncRafRef.current = null;
      }
    };
  }, [controllerRef, effectiveRenderManifest, isControlledRuntime]);

  return (
    <div className={cn(standalone ? "block" : "grid h-full gap-4", className)}>
      {showControls ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="quiet">Live preview</Badge>
            <Badge>{mode}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={mode === "desktop" ? "default" : "quiet"}
              size="sm"
              onClick={() => { setInternalMode("desktop"); onModeChange?.("desktop"); }}
            >
              Desktop
            </Button>
            <Button
              variant={mode === "mobile" ? "default" : "quiet"}
              size="sm"
              onClick={() => { setInternalMode("mobile"); onModeChange?.("mobile"); }}
            >
              Mobile
            </Button>
            {onPlayToggle ? (
              <Button variant="quiet" size="sm" onClick={onPlayToggle}>
                Toggle playback
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={cn(
          isControlledRuntime
            ? "relative h-full min-h-0 overflow-hidden rounded-none bg-[var(--panel-bg-preview)]"
            : standalone
              ? "relative bg-[var(--panel-bg-preview)]"
              : "relative min-h-screen bg-[var(--panel-bg-preview)]",
          stageClassName,
        )}
        style={emptyCanvasBackground ? { background: emptyCanvasBackground } : undefined}
        onClick={(event) => {
          const target = event.target as HTMLElement | null;
          if (!target) {
            return;
          }
          if (target.closest("[data-overlay-id]") || target.closest("[data-overlay-selection-chrome]")) {
            return;
          }
          const editing =
            document.activeElement &&
            (document.activeElement as HTMLElement).contentEditable === "true";
          if (!editing) {
            onSelectOverlay?.("");
          }
        }}
      >
        <div
          ref={mountNodeRef}
          className={
            isControlledRuntime
              ? "absolute inset-0"
              : standalone
                ? "relative"
                : "relative min-h-screen"
          }
        />

        {!hasRenderableMedia && !isControlledRuntime ? (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-xl rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--panel-bg)] p-6 text-center">
              <Badge>{section?.presetId ?? "preset"}</Badge>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
                The preview opens up as soon as media is attached.
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                Upload a source clip to see the full runtime come alive.
              </p>
            </div>
          </div>
        ) : null}

        {isControlledRuntime && selectedOverlay && selectedOverlayId ? (
          <OverlayManipulator
            overlay={selectedOverlay}
            selectedOverlayId={selectedOverlayId}
            selectedOverlayIds={selectedOverlayIds}
            selectionOverlays={
              selectedOverlayIds?.length
                ? latestSection?.overlays.filter((overlay) => (
                    selectedOverlayIds.includes(overlay.id)
                    || (
                      overlay.content.parentGroupId !== undefined
                      && selectedOverlayIds.includes(overlay.content.parentGroupId)
                    )
                  ))
                : selectedOverlay && selectedOverlay.content.type === "group"
                  ? latestSection?.overlays.filter((overlay) => (
                      overlay.id === selectedOverlay.id || overlay.content.parentGroupId === selectedOverlay.id
                    ))
                  : undefined
            }
            containerRef={containerRef}
            selectedStyle={selectedStyle}
            isTextStyle={isSelectedText}
            allowLayoutEditing={!selectedOverlay.content.parentGroupId}
            onLayoutChange={(layout, options) => {
              onOverlayLayoutChange?.(selectedOverlayId, layout, options);
            }}
            onStyleLiveChange={(changes) => { onOverlayStyleLiveChange?.(selectedOverlayId, changes); }}
            onStyleChange={(changes) => { onOverlayStyleChange?.(selectedOverlayId, changes); }}
            onEdit={() => { onSelectOverlay?.(selectedOverlayId); }}
            canGroupSelection={canGroupSelection}
            canUngroupSelection={canUngroupSelection}
            onGroupSelection={onGroupSelection}
            onUngroupSelection={onUngroupSelection}
            onDuplicate={() => { onDuplicateOverlay?.(selectedOverlayId); }}
            onDelete={() => { onDeleteOverlay?.(selectedOverlayId); }}
            onMoveSelection={onMoveSelection}
            onDuplicateSelection={onDuplicateSelection}
            onDeleteSelection={onDeleteSelection}
            onInteractingChange={setInteracting}
          />
        ) : null}
      </div>
    </div>
  );
}
