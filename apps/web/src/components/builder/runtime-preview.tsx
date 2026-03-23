"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clampProgress } from "@motionroll/shared";
import type { ProjectManifest } from "@motionroll/shared";
import { withOpacity, type ScrollSectionController } from "@motionroll/runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OverlayManipulator } from "./overlay-manipulator";
import { useRuntimeController } from "./hooks/useRuntimeController";

const DESIGN_STAGE_WIDTH = 1440;
const DESIGN_STAGE_HEIGHT = 810;

function getOverlayPixelPlacement(
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

type RuntimePreviewProps = {
  manifest: ProjectManifest;
  mode?: "desktop" | "mobile";
  standalone?: boolean;
  isPlaying?: boolean;
  playheadProgress?: number;
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

/**
 * Applies manifest overlay styles to live DOM nodes inside the preview container.
 * Must be called from within a requestAnimationFrame callback.
 */
function applyManifestOverlayStyles(
  manifest: ProjectManifest,
  container: HTMLElement,
  controller: ScrollSectionController,
  onWireInteractivity: () => void,
): void {
  const sec = manifest.sections[0];
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

  // Per-sync placement cache — avoids recomputing parent placements
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
    const style  = overlay.content.style;
    const bg     = overlay.content.background;
    const placement = getPlacement(overlay);
    const parentOverlay = overlay.content.parentGroupId
      ? sec.overlays.find((item) => item.id === overlay.content.parentGroupId)
      : undefined;
    const parentPlacement = parentOverlay
      ? getPlacement(parentOverlay)
      : undefined;

    // Geometry
    card.style.position  = "absolute";
    card.style.left      = overlay.content.align === "center"
      ? `${Math.round((parentPlacement ? placement.anchorLeft - parentPlacement.left : placement.anchorLeft))}px`
      : `${Math.round((parentPlacement ? placement.left - parentPlacement.left : placement.left))}px`;
    card.style.top       = overlay.content.align === "center"
      ? `${Math.round((parentPlacement ? placement.anchorTop - parentPlacement.top : placement.anchorTop))}px`
      : `${Math.round((parentPlacement ? placement.top - parentPlacement.top : placement.top))}px`;
    card.style.right     = "auto";
    card.style.bottom    = "auto";
    card.style.width     = `${placement.width}px`;
    card.style.minHeight = placement.height ? `${placement.height}px` : "";
    card.style.height    = placement.height ? `${placement.height}px` : "";
    card.style.maxWidth  = overlay.content.type === "group"
      ? `${placement.width}px`
      : `${Math.round((style?.maxWidth ?? layout?.width ?? 420) * scale)}px`;
    card.style.zIndex    = String(100 + (overlay.content.layer ?? 0));
    card.style.transform = overlay.content.align === "center"
      ? "translate3d(-50%,-50%,0)"
      : "translate3d(0,0,0)";
    card.style.overflow = overlay.content.type === "group" ? "visible" : "";

    if (!layout) {
      card.style.left   = overlay.content.align === "center" ? "50%" : `${Math.round(32 * scale)}px`;
      card.style.top    = overlay.content.align === "end" ? "auto" : `${Math.round(32 * scale)}px`;
      card.style.bottom = overlay.content.align === "end" ? `${Math.round(32 * scale)}px` : "auto";
    }

    // Card visuals
    card.style.opacity        = String(style?.opacity ?? 1);
    card.style.padding        = overlay.content.type === "group"
      ? "0px"
      : `${Math.round((bg?.paddingY ?? 14) * scale)}px ${Math.round((bg?.paddingX ?? 18) * scale)}px`;
    card.style.borderRadius   = `${bg?.radius ?? 14}px`;
    card.style.borderWidth    = bg?.enabled ? "1px" : "0";
    card.style.borderStyle    = overlay.content.type === "group" ? "dashed" : "solid";
    card.style.borderColor    = withOpacity(
      bg?.borderColor ?? "#d6f6ff",
      bg?.borderOpacity ?? (overlay.content.type === "group" ? 0.18 : 0),
    );
    card.style.background     = bg?.enabled
      ? withOpacity(bg.color ?? "#0d1016", bg.opacity ?? 0.82)
      : overlay.content.type === "group"
        ? "rgba(205,239,255,0.035)"
      : "transparent";
    card.style.borderWidth    = bg?.enabled || overlay.content.type === "group" ? "1px" : "0";
    card.style.backdropFilter = bg?.enabled ? "blur(18px)" : "none";

    if (overlay.content.type === "group") {
      continue;
    }

    // Text styles
    const textAlign = style?.textAlign === "start" ? "left"
      : style?.textAlign === "end" ? "right"
      : "center";
    const sharedText: Partial<CSSStyleDeclaration> = {
      fontFamily:     style?.fontFamily ?? "Inter",
      fontWeight:     String(style?.fontWeight ?? 600),
      fontStyle:      style?.italic ? "italic" : "normal",
      textDecoration: style?.underline ? "underline" : "none",
      color:          style?.color ?? "#f6f7fb",
      textAlign,
      letterSpacing:  `${style?.letterSpacing ?? 0}em`,
      textTransform:  (style?.textTransform ?? "none") as string,
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

    // Media / action link
    const media = card.querySelector<HTMLElement>("[data-media-field='media']");
    if (media) {
      media.style.maxWidth = `${Math.round((layout?.width ?? 420) * scale)}px`;
      if (overlay.content.type === "icon") media.style.height = `${Math.round(64 * scale)}px`;
      else if (overlay.content.type === "logo") media.style.height = `${Math.round(80 * scale)}px`;
    }

    const actionLink = card.querySelector<HTMLElement>("a");
    if (actionLink) {
      actionLink.style.marginTop = `${Math.round(16 * scale)}px`;
      actionLink.style.fontSize  = `${Math.round(14 * scale)}px`;
      if (style?.buttonLike) actionLink.style.padding = `${Math.round(9 * scale)}px ${Math.round(14 * scale)}px`;
    }
  }

  controller.setProgress(controller.getProgress());
  onWireInteractivity();
}

export function RuntimePreview({
  manifest,
  mode: controlledMode,
  standalone = false,
  isPlaying = false,
  playheadProgress,
  onPlayheadChange,
  onModeChange,
  onPlayToggle,
  onSelectOverlay,
  onOverlayLayoutChange,
  onInlineTextChange,
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
  // ── Refs ───────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountNodeRef = useRef<HTMLDivElement | null>(null);

  const isInteractingRef = useRef(false);
  const pendingManifestRef = useRef<ProjectManifest | null>(null);
  const wireRafRef = useRef<number | null>(null);
  const syncRafRef = useRef<number | null>(null);
  // Latest manifest captured for the pending RAF sync — always up to date.
  const pendingSyncManifestRef = useRef<typeof renderManifest | null>(null);

  // ── State ──────────────────────────────────────────────────────────────
  const [internalMode, setInternalMode] = useState<"desktop" | "mobile">("desktop");
  const [renderManifest, setRenderManifest] = useState(manifest);

  // ── Derived ────────────────────────────────────────────────────────────
  const mode = controlledMode ?? internalMode;
  const isControlledRuntime = typeof playheadProgress === "number";
  const section = renderManifest.sections[0];
  const hasRenderableMedia =
    (section?.frameAssets.length ?? 0) > 0 ||
    Boolean(section?.fallback.posterUrl) ||
    Boolean(section?.fallback.fallbackVideoUrl);

  const selectedOverlay = useMemo(
    () => section?.overlays.find((o: { id: string }) => o.id === selectedOverlayId),
    [section?.overlays, selectedOverlayId],
  );
  const selectedStyle = selectedOverlay?.content.style;
  const isSelectedText =
    selectedOverlay?.content.type === "text" ||
    (!selectedOverlay?.content.type && Boolean(selectedOverlay));

  // ── Restart key ────────────────────────────────────────────────────────
  //
  // The runtime closes over `section` at creation time. Any call to
  // setProgress/renderForProgress will re-apply overlay positions from that
  // stale snapshot via syncOverlayPresentationStyles, undoing DOM patches.
  //
  // We therefore include overlay layout AND timing in the restart key so the
  // runtime is rebuilt whenever a position/size/timing commit happens. This
  // means one restart per drag-commit or timing edit — acceptable because
  // it's a single operation.
  //
  // Style/text/font changes are deliberately excluded: they change frequently
  // (every keypress) and the light overlay-sync effect handles them correctly
  // because setProgress does not re-apply style properties.
  const restartKey = useMemo(() => {
    const s = renderManifest.sections[0];
    return JSON.stringify({
      mode,
      isPlaying,
      isControlledRuntime,
      hasRenderableMedia,
      frameCount: s?.frameCount ?? 0,
      frameRangeStart: s?.progressMapping.frameRange.start ?? 0,
      frameRangeEnd: s?.progressMapping.frameRange.end ?? 0,
      sampleFrames: s?.frameAssets.slice(0, 2).map((f) => f.variants[0]?.url ?? ""),
      posterUrl: s?.fallback.posterUrl ?? "",
      fallbackVideoUrl: s?.fallback.fallbackVideoUrl ?? "",
      firstFrameUrl: s?.fallback.firstFrameUrl ?? "",
      presetId: s?.presetId ?? "",
      // Overlay layout + timing: these are what setProgress re-applies via
      // syncOverlayPresentationStyles, so the runtime must hold current values.
      overlayGeometry: s?.overlays.map((o) => ({
        id: o.id,
        layer: o.content.layer ?? 0,
        x: o.content.layout?.x,
        y: o.content.layout?.y,
        w: o.content.layout?.width,
        h: o.content.layout?.height,
        align: o.content.align,
        animationPreset: o.content.animation?.preset,
        transitionPreset: o.content.transition?.preset,
        ts: o.timing.start,
        te: o.timing.end,
      })),
    });
  }, [hasRenderableMedia, isControlledRuntime, isPlaying, mode, renderManifest]);

  // ── Interaction gate ───────────────────────────────────────────────────
  function setInteracting(active: boolean) {
    isInteractingRef.current = active;
    if (!active && pendingManifestRef.current) {
      const next = pendingManifestRef.current;
      pendingManifestRef.current = null;
      if (renderManifest !== next) {
        setRenderManifest(next);
      }
    }
  }

  // ── Manifest guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isInteractingRef.current) {
      pendingManifestRef.current = manifest;
      return;
    }
    if (renderManifest !== manifest) {
      setRenderManifest(manifest);
    }
  }, [manifest, renderManifest]);

  // ── Overlay interactivity wiring ───────────────────────────────────────
  function wireOverlayInteractivity() {
    const container = containerRef.current;
    if (!container) return;
    const root = container.querySelector(".motionroll-overlay-root");
    if (!(root instanceof HTMLElement)) return;

    for (const child of Array.from(root.querySelectorAll<HTMLElement>("[data-overlay-id]"))) {
      const overlayId = child.dataset.overlayId;
      if (!overlayId) continue;

      child.onclick = (e) => {
        if (child.dataset.state !== "active") return;
        e.preventDefault();
        e.stopPropagation();
        onSelectOverlay?.(overlayId, {
          additive: (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey,
        });
      };
      child.style.cursor = child.dataset.state === "active" ? "pointer" : "";

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
    if (wireRafRef.current !== null) return;
    wireRafRef.current = requestAnimationFrame(() => {
      wireRafRef.current = null;
      wireOverlayInteractivity();
    });
  }

  useEffect(() => {
    if (!isControlledRuntime) return;
    scheduleWireInteractivity();
  }, [selectedOverlayId, renderManifest, isControlledRuntime]);

  // ── Controller lifecycle (restart, scroll-mode, playhead, auto-deselect) ─
  const { controllerRef, lastInternalProgressRef } = useRuntimeController({
    manifest,
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
  });

  // ── Light effect: full overlay DOM sync (no runtime restart) ─────────
  //
  // RAF-debounced: multiple manifest updates in the same frame (e.g. rapid
  // color picker moves) collapse into a single DOM write per animation frame.
  useEffect(() => {
    if (!isControlledRuntime || !controllerRef.current) return;

    // Capture the manifest at schedule time; the RAF callback reads from the
    // ref so it always uses the value current at execution time.
    pendingSyncManifestRef.current = renderManifest;

    if (syncRafRef.current !== null) {
      // Already scheduled — the pending ref is updated above, nothing else needed.
      return;
    }

    syncRafRef.current = requestAnimationFrame(() => {
      syncRafRef.current = null;
      const manifest = pendingSyncManifestRef.current;
      pendingSyncManifestRef.current = null;
      if (!manifest || !controllerRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      applyManifestOverlayStyles(
        manifest,
        container,
        controllerRef.current,
        scheduleWireInteractivity,
      );
    }); // end requestAnimationFrame

    return () => {
      if (syncRafRef.current !== null) {
        cancelAnimationFrame(syncRafRef.current);
        syncRafRef.current = null;
      }
    };
  }, [renderManifest, isControlledRuntime]);

  // ── Render ─────────────────────────────────────────────────────────────
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

        {!hasRenderableMedia ? (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-xl rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--panel-bg)] p-6 text-center">
              <Badge>{section?.presetId ?? "preset"}</Badge>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
                The preview opens up as soon as media is attached.
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                Upload a source or import a generated clip to see the full runtime come alive.
              </p>
            </div>
          </div>
        ) : null}

        {isControlledRuntime && selectedOverlay && selectedOverlayId ? (
          <OverlayManipulator
            key={selectedOverlayId}
            overlay={selectedOverlay}
            selectedOverlayId={selectedOverlayId}
            selectedOverlayIds={selectedOverlayIds}
            selectionOverlays={
              selectedOverlayIds?.length
                ? section?.overlays.filter((overlay) => (
                  selectedOverlayIds.includes(overlay.id)
                  || (
                    overlay.content.parentGroupId !== undefined
                    && selectedOverlayIds.includes(overlay.content.parentGroupId)
                  )
                ))
                : selectedOverlay && selectedOverlay.content.type === "group"
                  ? section?.overlays.filter((overlay) => (
                    overlay.id === selectedOverlay.id || overlay.content.parentGroupId === selectedOverlay.id
                  ))
                  : undefined
            }
            containerRef={containerRef}
            selectedStyle={selectedStyle}
            isTextStyle={isSelectedText}
            allowLayoutEditing={!selectedOverlay.content.parentGroupId}
            onLayoutChange={(layout, options) => { onOverlayLayoutChange?.(selectedOverlayId, layout, options); }}
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
