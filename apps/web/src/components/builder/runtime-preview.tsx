"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { clampProgress } from "@motionroll/shared";
import type { ProjectManifest } from "@motionroll/shared";
import { createScrollSection, type ScrollSectionController } from "@motionroll/runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InlineTextToolbar } from "./inline-text-toolbar";

const MoveableLayer = dynamic(() => import("react-moveable"), { ssr: false });

type RuntimePreviewProps = {
  manifest: ProjectManifest;
  mode?: "desktop" | "mobile";
  reducedMotion?: boolean;
  playheadProgress?: number;
  onPlayheadChange?: (progress: number) => void;
  onModeChange?: (mode: "desktop" | "mobile") => void;
  onReducedMotionChange?: (value: boolean) => void;
  onPlayToggle?: () => void;
  onSelectOverlay?: (overlayId: string) => void;
  onOverlayLayoutChange?: (
    overlayId: string,
    layout: Partial<{ x: number; y: number; width: number; height: number }>,
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountNodeRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ScrollSectionController | null>(null);
  const lastInternalProgressRef = useRef<number | null>(null);
  const [internalMode, setInternalMode] = useState<"desktop" | "mobile">("desktop");
  const [internalReducedMotion, setInternalReducedMotion] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [moveableReady, setMoveableReady] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const mode = controlledMode ?? internalMode;
  const reducedMotion = controlledReducedMotion ?? internalReducedMotion;
  const section = manifest.sections[0];
  const hasRenderableMedia =
    (section?.frameAssets.length ?? 0) > 0 ||
    Boolean(section?.fallback.posterUrl) ||
    Boolean(section?.fallback.fallbackVideoUrl);

  const selectedOverlay = useMemo(
    () => section?.overlays.find((overlay) => overlay.id === selectedOverlayId),
    [section?.overlays, selectedOverlayId],
  );
  const selectedStyle = selectedOverlay?.content.style;
  const isSelectedText = selectedOverlay?.content.type === "text" || (!selectedOverlay?.content.type && Boolean(selectedOverlay));

  const mountRuntime = useEffectEvent(() => {
    const node = mountNodeRef.current;
    if (!node) {
      return;
    }

    controllerRef.current?.destroy();
    node.replaceChildren();
    controllerRef.current = createScrollSection(node, manifest, {
      mode,
      reducedMotion,
      interactionMode: showControls ? "scroll" : "controlled",
      allowWheelScrub: !showControls,
      onProgressChange: (progress) => {
        lastInternalProgressRef.current = progress;
        onPlayheadChange?.(progress);
      },
    });
    if (typeof playheadProgress === "number") {
      controllerRef.current.setProgress(playheadProgress);
    }
  });

  useEffect(() => {
    setMoveableReady(true);
  }, []);

  useEffect(() => {
    if (!hasRenderableMedia) {
      setSelectedElement(null);
      return;
    }

    mountRuntime();

    return () => {
      controllerRef.current?.destroy();
      setSelectedElement(null);
    };
  }, [hasRenderableMedia, manifest, mode, reducedMotion, mountRuntime]);

  useEffect(() => {
    if (typeof playheadProgress !== "number") {
      return;
    }

    if (
      lastInternalProgressRef.current != null &&
      Math.abs(lastInternalProgressRef.current - playheadProgress) <= 0.001
    ) {
      lastInternalProgressRef.current = null;
      return;
    }

    controllerRef.current?.setProgress(playheadProgress);
  }, [playheadProgress]);

  useEffect(() => {
    const root = containerRef.current?.querySelector(".motionroll-overlay-root");
    if (!(root instanceof HTMLElement)) {
      setSelectedElement(null);
      return;
    }

    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-overlay-id]"));
    for (const card of cards) {
      const overlayId = card.dataset.overlayId;
      if (!overlayId) {
        continue;
      }

      card.classList.toggle("motionroll-preview-selected", overlayId === selectedOverlayId);
      card.onclick = (event) => {
        if (card.dataset.state !== "active") return;
        event.preventDefault();
        event.stopPropagation();
        onSelectOverlay?.(overlayId);
      };
      card.style.cursor = card.dataset.state === "active" ? "pointer" : "default";

      const textFields = Array.from(card.querySelectorAll<HTMLElement>("[data-text-field]"));
      for (const field of textFields) {
        const textField = field.dataset.textField;
        if (
          overlayId === selectedOverlayId &&
          (textField === "eyebrow" || textField === "headline" || textField === "body")
        ) {
          field.spellcheck = false;
          field.contentEditable = "true";
          field.onblur = () =>
            onInlineTextChange?.(
              overlayId,
              textField,
              field.textContent ?? "",
              field.innerHTML,
            );
        } else {
          field.contentEditable = "false";
          field.onblur = null;
        }
      }
    }

    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      const selected =
        selectedOverlayId != null
          ? root.querySelector<HTMLElement>(`[data-overlay-id="${selectedOverlayId}"]`)
          : null;
      setSelectedElement(selected instanceof HTMLElement && selected.isConnected ? selected : null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [hasRenderableMedia, manifest, onInlineTextChange, onSelectOverlay, selectedOverlayId]);

  useEffect(() => {
    if (!selectedElement || !containerRef.current || !isSelectedText) {
      setToolbarPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!selectedElement || !containerRef.current) return;
      const toolbarWidth = 320;
      const toolbarHeight = 44;
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;
      const left = Math.max(8, Math.min(
        selectedElement.offsetLeft + selectedElement.offsetWidth / 2 - toolbarWidth / 2,
        containerW - toolbarWidth - 8,
      ));
      // Prefer above the element; if not enough room, show below
      const aboveTop = selectedElement.offsetTop - toolbarHeight - 8;
      const belowTop = selectedElement.offsetTop + (selectedElement.offsetHeight ?? 0) + 8;
      const top = aboveTop >= 8 ? aboveTop : Math.min(belowTop, containerH - toolbarHeight - 8);
      setToolbarPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [isSelectedText, selectedElement]);

  const moveableBounds = containerRef.current
    ? {
        left: 0,
        top: 0,
        right: containerRef.current.clientWidth,
        bottom: containerRef.current.clientHeight,
      }
    : undefined;

  return (
    <div className={cn("grid h-full gap-4", className)}>
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
              onClick={() => {
                setInternalMode("desktop");
                onModeChange?.("desktop");
              }}
            >
              Desktop
            </Button>
            <Button
              variant={mode === "mobile" ? "default" : "quiet"}
              size="sm"
              onClick={() => {
                setInternalMode("mobile");
                onModeChange?.("mobile");
              }}
            >
              Mobile
            </Button>
            <Button
              variant={reducedMotion ? "secondary" : "quiet"}
              size="sm"
              onClick={() => {
                const nextValue = !reducedMotion;
                setInternalReducedMotion(nextValue);
                onReducedMotionChange?.(nextValue);
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
          "relative min-h-[58vh] overflow-hidden rounded-[8px] bg-[var(--panel-bg-preview)]",
          stageClassName,
        )}
      >
        <div ref={mountNodeRef} className="absolute inset-0" />
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

        {toolbarPosition && selectedOverlayId && isSelectedText ? (
          <InlineTextToolbar
            position={toolbarPosition}
            maxWidth={containerRef.current?.clientWidth}
            fontFamily={selectedStyle?.fontFamily ?? "Inter"}
            fontWeight={selectedStyle?.fontWeight ?? 600}
            fontSize={selectedStyle?.fontSize ?? 34}
            color={selectedStyle?.color ?? "#f6f7fb"}
            italic={selectedStyle?.italic ?? false}
            textAlign={(selectedStyle?.textAlign as "start" | "center" | "end") ?? "start"}
            onChange={(changes) => onOverlayStyleChange?.(selectedOverlayId, changes)}
            onDuplicate={() => onDuplicateOverlay?.(selectedOverlayId)}
            onDelete={() => onDeleteOverlay?.(selectedOverlayId)}
          />
        ) : null}
      </div>

      {moveableReady && selectedElement?.isConnected && selectedElement?.dataset?.state === "active" && containerRef.current ? (
        <MoveableLayer
          key={selectedOverlayId ?? "preview-selection"}
          target={selectedElement}
          container={containerRef.current}
          rootContainer={containerRef.current}
          bounds={moveableBounds}
          draggable
          resizable
          snappable
          throttleDrag={0}
          throttleResize={0}
          keepRatio={false}
          elementGuidelines={Array.from(
            containerRef.current.querySelectorAll<HTMLElement>("[data-overlay-id]"),
          ).filter((element) => element !== selectedElement)}
          verticalGuidelines={[0, containerRef.current.clientWidth / 2, containerRef.current.clientWidth]}
          horizontalGuidelines={[0, containerRef.current.clientHeight / 2, containerRef.current.clientHeight]}
          snapThreshold={8}
          origin={false}
          edge={false}
          renderDirections={["nw", "ne", "sw", "se"]}
          onDrag={({ target, left, top }) => {
            target.style.left = `${left}px`;
            target.style.top = `${top}px`;
            target.style.right = "auto";
            target.style.bottom = "auto";
            target.style.transform = "translate3d(0, 0, 0)";
          }}
          onDragEnd={({ target }) => {
            if (!(target instanceof HTMLElement) || !containerRef.current || !target.dataset.overlayId) {
              return;
            }
            // Use bounding rects so the measurement is always relative to the
            // container origin, regardless of the overlay-root scroll/transform.
            const cRect = containerRef.current.getBoundingClientRect();
            const tRect = target.getBoundingClientRect();
            const cW = Math.max(cRect.width, 1);
            const cH = Math.max(cRect.height, 1);
            onOverlayLayoutChange?.(target.dataset.overlayId, {
              x: clampProgress((tRect.left - cRect.left) / cW),
              y: clampProgress((tRect.top - cRect.top) / cH),
            });
          }}
          onResize={({ target, width, height, drag }) => {
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            target.style.left = `${drag.left}px`;
            target.style.top = `${drag.top}px`;
            target.style.right = "auto";
            target.style.bottom = "auto";
            target.style.transform = "translate3d(0, 0, 0)";
          }}
          onResizeEnd={({ target }) => {
            if (!(target instanceof HTMLElement) || !target.dataset.overlayId || !containerRef.current) {
              return;
            }
            const cRect = containerRef.current.getBoundingClientRect();
            const tRect = target.getBoundingClientRect();
            const cW = Math.max(cRect.width, 1);
            const cH = Math.max(cRect.height, 1);
            onOverlayLayoutChange?.(target.dataset.overlayId, {
              x: clampProgress((tRect.left - cRect.left) / cW),
              y: clampProgress((tRect.top - cRect.top) / cH),
              width: Math.round(target.offsetWidth),
              height: Math.round(target.offsetHeight),
            });
          }}
        />
      ) : null}
    </div>
  );
}
