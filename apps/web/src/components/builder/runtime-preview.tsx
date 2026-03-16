"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clampProgress } from "@motionroll/shared";
import type { ProjectManifest } from "@motionroll/shared";
import { createScrollSection, type ScrollSectionController } from "@motionroll/runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OverlayManipulator } from "./overlay-manipulator";

const DESIGN_STAGE_WIDTH = 1440;
const DESIGN_STAGE_HEIGHT = 810;

type RuntimePreviewProps = {
  manifest: ProjectManifest;
  mode?: "desktop" | "mobile";
  reducedMotion?: boolean;
  standalone?: boolean;
  isPlaying?: boolean;
  playheadProgress?: number;
  onPlayheadChange?: (progress: number) => void;
  onModeChange?: (mode: "desktop" | "mobile") => void;
  onReducedMotionChange?: (value: boolean) => void;
  onPlayToggle?: () => void;
  onSelectOverlay?: (overlayId: string) => void;
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
    field: "eyebrow" | "headline" | "body",
    value: string,
    htmlValue?: string,
  ) => void;
  onOverlayStyleChange?: (overlayId: string, changes: Record<string, unknown>) => void;
  onDuplicateOverlay?: (overlayId: string) => void;
  onDeleteOverlay?: (overlayId: string) => void;
  selectedOverlayId?: string;
  showControls?: boolean;
  className?: string;
  stageClassName?: string;
};

export function RuntimePreview({
  manifest,
  mode: controlledMode,
  reducedMotion: controlledReducedMotion,
  standalone = false,
  playheadProgress,
  onPlayheadChange,
  onModeChange,
  onReducedMotionChange,
  onPlayToggle,
  onSelectOverlay,
  onOverlayLayoutChange,
  onInlineTextChange,
  onOverlayStyleChange,
  onDuplicateOverlay,
  onDeleteOverlay,
  selectedOverlayId,
  showControls = true,
  className,
  stageClassName,
}: RuntimePreviewProps) {
  // ── Refs ───────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountNodeRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ScrollSectionController | null>(null);
  const onPlayheadChangeRef = useRef<typeof onPlayheadChange>(onPlayheadChange);
  const lastInternalProgressRef = useRef<number | null>(null);
  const isInteractingRef = useRef(false);
  const pendingManifestRef = useRef<ProjectManifest | null>(null);
  const pendingManifestSignatureRef = useRef<string | null>(null);
  const wireRafRef = useRef<number | null>(null);
  const syncRafRef = useRef<number | null>(null);
  // Latest manifest captured for the pending RAF sync — always up to date.
  const pendingSyncManifestRef = useRef<typeof renderManifest | null>(null);

  // ── State ──────────────────────────────────────────────────────────────
  const [internalMode, setInternalMode] = useState<"desktop" | "mobile">("desktop");
  const [internalReducedMotion, setInternalReducedMotion] = useState(false);
  const [renderManifest, setRenderManifest] = useState(manifest);
  const renderManifestSignatureRef = useRef(JSON.stringify(manifest));
  const manifestSignature = useMemo(() => JSON.stringify(manifest), [manifest]);

  // ── Derived ────────────────────────────────────────────────────────────
  const mode = controlledMode ?? internalMode;
  const reducedMotion = controlledReducedMotion ?? internalReducedMotion;
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
      reducedMotion,
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
        x: o.content.layout?.x,
        y: o.content.layout?.y,
        w: o.content.layout?.width,
        h: o.content.layout?.height,
        align: o.content.align,
        ts: o.timing.start,
        te: o.timing.end,
      })),
    });
  }, [mode, reducedMotion, isControlledRuntime, hasRenderableMedia, renderManifest]);

  // ── Interaction gate ───────────────────────────────────────────────────
  function setInteracting(active: boolean) {
    isInteractingRef.current = active;
    if (!active && pendingManifestRef.current) {
      const next = pendingManifestRef.current;
      const nextSignature = pendingManifestSignatureRef.current ?? JSON.stringify(next);
      pendingManifestRef.current = null;
      pendingManifestSignatureRef.current = null;
      if (renderManifestSignatureRef.current !== nextSignature) {
        renderManifestSignatureRef.current = nextSignature;
        setRenderManifest(next);
      }
    }
  }

  // ── Ref sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    onPlayheadChangeRef.current = onPlayheadChange;
  }, [onPlayheadChange]);

  // ── Manifest guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isInteractingRef.current) {
      pendingManifestRef.current = manifest;
      pendingManifestSignatureRef.current = manifestSignature;
      return;
    }
    if (renderManifestSignatureRef.current !== manifestSignature) {
      renderManifestSignatureRef.current = manifestSignature;
      setRenderManifest(manifest);
    }
  }, [manifest, manifestSignature]);

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
        onSelectOverlay?.(overlayId);
      };
      child.style.cursor = child.dataset.state === "active" ? "pointer" : "";

      const isSelected = overlayId === selectedOverlayId;
      const isActive = child.dataset.state === "active";

      for (const field of Array.from(child.querySelectorAll<HTMLElement>("[data-text-field]"))) {
        const name = field.dataset.textField as "eyebrow" | "headline" | "body" | undefined;
        const editable =
          isSelected && isActive && (name === "eyebrow" || name === "headline" || name === "body");
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

  useEffect(() => {
    if (!isControlledRuntime) return;
    scheduleWireInteractivity();
  }, [playheadProgress, isControlledRuntime]);

  // ── Heavy effect: full runtime restart (structural changes only) ────────
  //
  // Depends on `restartKey`, NOT `renderManifest`. Overlay-only manifest
  // changes (layout, style, text) do not change the restart key and will
  // never trigger this effect. Only frame assets, fallback URLs, mode,
  // reducedMotion, and similar structural fields cause a restart.
  useEffect(() => {
    if (!isControlledRuntime || !hasRenderableMedia) return;
    const node = mountNodeRef.current;
    if (!node) return;

    const existing = controllerRef.current;
    if (existing) {
      existing.destroy();
      node.replaceChildren();
    }
    controllerRef.current = createScrollSection(node, renderManifest, {
      initialProgress: playheadProgress ?? 0,
      mode,
      reducedMotion,
      interactionMode: "controlled",
      allowWheelScrub: false,
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
      if (wireRafRef.current !== null) {
        cancelAnimationFrame(wireRafRef.current);
        wireRafRef.current = null;
      }
      controllerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

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
      const sec = manifest.sections[0];
      if (!sec) return;

      const cW = Math.max(container.clientWidth, 1);
      const cH = Math.max(container.clientHeight, 1);
      const scale = Math.max(0.35, Math.min(cW / DESIGN_STAGE_WIDTH, cH / DESIGN_STAGE_HEIGHT));

      function withOpacity(hex: string, opacity: number) {
        const v = hex.replace("#", "").trim();
        const norm = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
        if (!/^[0-9a-fA-F]{6}$/.test(norm)) return hex;
        const r = parseInt(norm.slice(0, 2), 16);
        const g = parseInt(norm.slice(2, 4), 16);
        const b = parseInt(norm.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${opacity})`;
      }

      for (const overlay of sec.overlays) {
        const card = container.querySelector<HTMLElement>(`[data-overlay-id="${overlay.id}"]`);
        if (!card) continue;

        const layout = overlay.content.layout;
        const style  = overlay.content.style;
        const bg     = overlay.content.background;

        // Geometry
        card.style.position  = "absolute";
        card.style.left      = `${(layout?.x ?? 0.08) * 100}%`;
        card.style.top       = `${(layout?.y ?? 0.12) * 100}%`;
        card.style.right     = "auto";
        card.style.bottom    = "auto";
        card.style.width     = `${Math.round((layout?.width ?? 420) * scale)}px`;
        card.style.minHeight = layout?.height ? `${Math.round(layout.height * scale)}px` : "";
        card.style.height    = layout?.height ? `${Math.round(layout.height * scale)}px` : "";
        card.style.maxWidth  = `${Math.round((style?.maxWidth ?? layout?.width ?? 420) * scale)}px`;
        card.style.transform = overlay.content.align === "center"
          ? "translate3d(-50%,-50%,0)"
          : "translate3d(0,0,0)";
        card.style.transition = "";

        if (!layout) {
          card.style.left   = overlay.content.align === "center" ? "50%" : `${Math.round(32 * scale)}px`;
          card.style.top    = overlay.content.align === "end" ? "auto" : `${Math.round(32 * scale)}px`;
          card.style.bottom = overlay.content.align === "end" ? `${Math.round(32 * scale)}px` : "auto";
        }

        // Card visuals
        card.style.opacity        = String(style?.opacity ?? 1);
        card.style.padding        = `${Math.round((bg?.paddingY ?? 14) * scale)}px ${Math.round((bg?.paddingX ?? 18) * scale)}px`;
        card.style.borderRadius   = `${bg?.radius ?? 14}px`;
        card.style.borderWidth    = bg?.enabled ? "1px" : "0";
        card.style.borderStyle    = "solid";
        card.style.borderColor    = withOpacity(bg?.borderColor ?? "#d6f6ff", bg?.borderOpacity ?? 0);
        card.style.background     = bg?.enabled && bg.mode === "solid"
          ? withOpacity(bg.color ?? "#0d1016", bg.opacity ?? 0.82)
          : "transparent";
        card.style.backdropFilter = bg?.enabled && bg.mode === "solid" ? "blur(18px)" : "none";

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

        const headline = card.querySelector<HTMLElement>('[data-text-field="headline"]');
        if (headline) Object.assign(headline.style, { ...sharedText, fontSize: `${Math.round((style?.fontSize ?? 34) * scale)}px`, lineHeight: String(style?.lineHeight ?? 1.08) });

        const eyebrow = card.querySelector<HTMLElement>('[data-text-field="eyebrow"]');
        if (eyebrow) Object.assign(eyebrow.style, { ...sharedText, fontSize: `${Math.round((style?.eyebrowFontSize ?? 12) * scale)}px`, opacity: "0.72" });

        const body = card.querySelector<HTMLElement>('[data-text-field="body"]');
        if (body) Object.assign(body.style, { ...sharedText, fontSize: `${Math.round((style?.bodyFontSize ?? 15) * scale)}px` });

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

      scheduleWireInteractivity();
    }); // end requestAnimationFrame

    return () => {
      if (syncRafRef.current !== null) {
        cancelAnimationFrame(syncRafRef.current);
        syncRafRef.current = null;
      }
    };
  }, [renderManifest, isControlledRuntime]);

  // ── Runtime: scroll mode ───────────────────────────────────────────────
  useEffect(() => {
    if (isControlledRuntime || !hasRenderableMedia) return;
    const node = mountNodeRef.current;
    if (!node) return;

    const existing = controllerRef.current;
    if (existing) {
      existing.destroy();
      node.replaceChildren();
    }
    controllerRef.current = createScrollSection(node, renderManifest, {
      mode,
      reducedMotion,
      interactionMode: "scroll",
      allowWheelScrub: false,
    });

    return () => controllerRef.current?.destroy();
  }, [hasRenderableMedia, isControlledRuntime, mode, reducedMotion, renderManifest]);

  // ── Auto-deselect when playhead leaves the overlay's timing window ────
  useEffect(() => {
    if (!isControlledRuntime || typeof playheadProgress !== "number") return;
    if (!selectedOverlay || isInteractingRef.current) return;
    const { start, end } = selectedOverlay.timing;
    const active = playheadProgress >= start && playheadProgress < end + 0.0001;
    if (!active) onSelectOverlay?.("");
  }, [playheadProgress, selectedOverlay, isControlledRuntime]);

  // ── Playhead sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isControlledRuntime || typeof playheadProgress !== "number") return;
    if (isInteractingRef.current) return;

    if (
      lastInternalProgressRef.current !== null &&
      Math.abs(lastInternalProgressRef.current - playheadProgress) <= 0.001
    ) {
      lastInternalProgressRef.current = null;
      return;
    }

    controllerRef.current?.setProgress(playheadProgress);
  }, [playheadProgress, isControlledRuntime]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={cn(standalone ? "block" : "grid h-full gap-4", className)}>
      {showControls ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="quiet">Live preview</Badge>
            <Badge>{mode}</Badge>
            {reducedMotion ? <Badge variant="quiet">Reduced motion</Badge> : null}
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
            <Button
              variant={reducedMotion ? "secondary" : "quiet"}
              size="sm"
              onClick={() => {
                const next = !reducedMotion;
                setInternalReducedMotion(next);
                onReducedMotionChange?.(next);
              }}
            >
              Reduced motion
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
            containerRef={containerRef}
            selectedStyle={selectedStyle}
            isTextStyle={isSelectedText}
            onLayoutChange={(layout, options) => { onOverlayLayoutChange?.(selectedOverlayId, layout, options); }}
            onStyleChange={(changes) => { onOverlayStyleChange?.(selectedOverlayId, changes); }}
            onEdit={() => { onSelectOverlay?.(selectedOverlayId); }}
            onDuplicate={() => { onDuplicateOverlay?.(selectedOverlayId); }}
            onDelete={() => { onDeleteOverlay?.(selectedOverlayId); }}
            onInteractingChange={setInteracting}
          />
        ) : null}
      </div>
    </div>
  );
}
