"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";
import type { RefObject, PointerEvent as ReactPointerEvent } from "react";
import type { OverlayDefinition } from "@motionroll/shared";
import { Move } from "lucide-react";
import { createPortal } from "react-dom";
import { InlineTextToolbar } from "./inline-text-toolbar";
import {
  CORNER_HANDLE_HALF,
  DRAG_HANDLE_OFFSET,
  DRAG_HANDLE_SIZE,
  MIN_BOX_DIMENSION,
  getStageScale,
  overlayToBox,
  unionBoxes,
  boxToLayout,
  toolbarPos,
  getResizeStyleChanges,
  getLiveResizeTargets,
  type Box,
  type Corner,
  type LiveResizeTargets,
} from "./overlay-manipulator-utils";
import type { LayoutChangeOptions } from "./editor-overlay-utils";

export type OverlayManipulatorProps = {
  overlay: OverlayDefinition;
  selectedOverlayId?: string;
  selectedOverlayIds?: string[];
  selectionOverlays?: OverlayDefinition[];
  containerRef: RefObject<HTMLElement | null>;
  selectedStyle?: OverlayDefinition["content"]["style"];
  isTextStyle?: boolean;
  allowLayoutEditing?: boolean;
  onLayoutChange?: (
    layout: Partial<{ x: number; y: number; width: number; height: number }>,
    options?: LayoutChangeOptions,
  ) => void;
  onStyleLiveChange?: (changes: Record<string, unknown>) => void;
  onStyleChange?: (changes: Record<string, unknown>) => void;
  onEdit?: () => void;
  canGroupSelection?: boolean;
  canUngroupSelection?: boolean;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMoveSelection?: (delta: { x: number; y: number }) => void;
  onDuplicateSelection?: () => void;
  onDeleteSelection?: () => void;
  onInteractingChange?: (active: boolean) => void;
};

export function OverlayManipulator({
  overlay,
  selectedOverlayId,
  selectedOverlayIds,
  selectionOverlays,
  containerRef,
  selectedStyle,
  isTextStyle,
  allowLayoutEditing = true,
  onLayoutChange,
  onStyleLiveChange,
  onStyleChange,
  onEdit,
  canGroupSelection = false,
  canUngroupSelection = false,
  onGroupSelection,
  onUngroupSelection,
  onDuplicate,
  onDelete,
  onMoveSelection,
  onDuplicateSelection,
  onDeleteSelection,
  onInteractingChange,
}: OverlayManipulatorProps) {
  // React state — only used for initial render and post-commit re-sync.
  const [box, setBox] = useState<Box | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Ref always holds the latest box; closures read from here, not state.
  const boxRef = useRef<Box | null>(null);
  const interactionActiveRef = useRef(false);
  const measureRafRef = useRef<number | null>(null);
  const previousSelectionIdentityRef = useRef<string>("");

  // ── DOM refs for all chrome elements ──────────────────────────────────
  const outlineRef   = useRef<HTMLDivElement | null>(null);
  const handleNwRef  = useRef<HTMLButtonElement | null>(null);
  const handleNeRef  = useRef<HTMLButtonElement | null>(null);
  const handleSwRef  = useRef<HTMLButtonElement | null>(null);
  const handleSeRef  = useRef<HTMLButtonElement | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  const toolbarWrapRef = useRef<HTMLDivElement | null>(null);
  const selectionIds = (selectedOverlayIds?.length ? selectedOverlayIds : [selectedOverlayId]).filter(Boolean);
  const selectionCardIds = (selectionOverlays?.length
    ? selectionOverlays.map((item) => item.id)
    : selectionIds
  ).filter(Boolean);
  const isMultiSelection = selectionIds.length > 1;
  const selectionKey = selectionCardIds.join("|");
  const selectionIdentity = `${selectedOverlayId ?? ""}|${selectionKey}`;

  function getFallbackSelectionBox(container: HTMLElement): Box | null {
    const overlays = selectionOverlays?.length ? selectionOverlays : [overlay];
    if (!overlays.length) {
      return null;
    }
    return unionBoxes(
      overlays.map((item) => overlayToBox(item, container, boxRef.current?.height ?? 100)),
    );
  }

  function getContainerViewportRect() {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }

  function getChromeViewportMetrics(b: Box) {
    const containerRect = getContainerViewportRect();
    const cW = containerRef.current?.clientWidth ?? 0;
    const cH = containerRef.current?.clientHeight ?? 0;
    if (!containerRect || !cW || !cH) {
      return null;
    }
    const tb = toolbarPos(b, cW, cH);
    return {
      left: containerRect.left + b.left,
      top: containerRect.top + b.top,
      width: b.width,
      height: b.height,
      toolbarLeft: containerRect.left + tb.left - 8,
      toolbarTop: containerRect.top + tb.top - 8,
      maxToolbarWidth: cW,
    };
  }

  // ── Apply box to all DOM elements synchronously ───────────────────────
  function applyBoxToDom(b: Box) {
    const metrics = getChromeViewportMetrics(b);
    if (!metrics) return;

    // Outline
    if (outlineRef.current) {
      const s = outlineRef.current.style;
      s.left   = `${metrics.left}px`;
      s.top    = `${metrics.top}px`;
      s.width  = `${metrics.width}px`;
      s.height = `${metrics.height}px`;
    }

    // Handles
    if (handleNwRef.current) {
      handleNwRef.current.style.left = `${metrics.left - CORNER_HANDLE_HALF}px`;
      handleNwRef.current.style.top  = `${metrics.top  - CORNER_HANDLE_HALF}px`;
    }
    if (handleNeRef.current) {
      handleNeRef.current.style.left = `${metrics.left + metrics.width - CORNER_HANDLE_HALF}px`;
      handleNeRef.current.style.top  = `${metrics.top  - CORNER_HANDLE_HALF}px`;
    }
    if (handleSwRef.current) {
      handleSwRef.current.style.left = `${metrics.left - CORNER_HANDLE_HALF}px`;
      handleSwRef.current.style.top  = `${metrics.top  + metrics.height - CORNER_HANDLE_HALF}px`;
    }
    if (handleSeRef.current) {
      handleSeRef.current.style.left = `${metrics.left + metrics.width - CORNER_HANDLE_HALF}px`;
      handleSeRef.current.style.top  = `${metrics.top  + metrics.height - CORNER_HANDLE_HALF}px`;
    }

    if (dragHandleRef.current) {
      dragHandleRef.current.style.left = `${metrics.left + metrics.width - DRAG_HANDLE_SIZE - DRAG_HANDLE_OFFSET}px`;
      dragHandleRef.current.style.top = `${metrics.top + DRAG_HANDLE_OFFSET}px`;
    }

    // Toolbar wrapper
    if (toolbarWrapRef.current) {
      toolbarWrapRef.current.style.left = `${metrics.toolbarLeft}px`;
      toolbarWrapRef.current.style.top  = `${metrics.toolbarTop}px`;
    }
  }

  // ── Apply box to the runtime card ─────────────────────────────────────
  function getCard(): HTMLElement | null {
    return containerRef.current?.querySelector<HTMLElement>(
      `[data-overlay-id="${selectedOverlayId}"]`,
    ) ?? null;
  }

  function getSelectionCards() {
    return selectionCardIds
      .map((overlayId) => {
        const card = containerRef.current?.querySelector<HTMLElement>(`[data-overlay-id="${overlayId}"]`) ?? null;
        if (!card) {
          return null;
        }
        const isActive =
          card.dataset.state === "active" &&
          card.style.visibility !== "hidden" &&
          card.ariaHidden !== "true";
        return isActive ? { overlayId, card } : null;
      })
      .filter((entry): entry is { overlayId: string; card: HTMLElement } => Boolean(entry));
  }

  function hasSelectionDomCards() {
    return selectionCardIds.some((overlayId) =>
      Boolean(containerRef.current?.querySelector<HTMLElement>(`[data-overlay-id="${overlayId}"]`)),
    );
  }

  function getSelectionBox(container: HTMLElement, allowFallback = true): Box | null {
    const cRect = container.getBoundingClientRect();
    const activeCards = getSelectionCards();
    const cardBoxes = activeCards.map(({ card }) => {
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left - cRect.left,
        top: rect.top - cRect.top,
        width: Math.max(rect.width, MIN_BOX_DIMENSION),
        height: Math.max(rect.height, MIN_BOX_DIMENSION),
      };
    });
    if (cardBoxes.length > 0) {
      return unionBoxes(cardBoxes);
    }

    if (hasSelectionDomCards()) {
      return null;
    }

    return allowFallback ? getFallbackSelectionBox(container) : null;
  }

  function boxesMatch(a: Box | null, b: Box | null) {
    if (!a || !b) {
      return a === b;
    }
    const tolerance = 0.5;
    return (
      Math.abs(a.left - b.left) < tolerance
      && Math.abs(a.top - b.top) < tolerance
      && Math.abs(a.width - b.width) < tolerance
      && Math.abs(a.height - b.height) < tolerance
    );
  }

  function measureSelectionBox(allowFallback = true) {
    const container = containerRef.current;
    if (!container) return;
    const next = getSelectionBox(container, allowFallback);
    if (boxesMatch(boxRef.current, next)) {
      if (!boxRef.current) {
        setBox(null);
      }
      return;
    }
    boxRef.current = next;
    setBox(next);
  }

  function syncSelectionBox() {
    const container = containerRef.current;
    if (!container) return;
    const selectionChanged = previousSelectionIdentityRef.current !== selectionIdentity;
    previousSelectionIdentityRef.current = selectionIdentity;
    const activeCards = getSelectionCards();
    const hasDomCards = activeCards.length > 0 || hasSelectionDomCards();

    if (selectionChanged || !boxRef.current) {
      if (activeCards.length > 0) {
        measureSelectionBox(false);
        return;
      }

      const immediateBox = hasDomCards ? null : getFallbackSelectionBox(container);
      if (!boxesMatch(boxRef.current, immediateBox)) {
        boxRef.current = immediateBox;
        setBox(immediateBox);
      } else if (!immediateBox && boxRef.current) {
        boxRef.current = null;
        setBox(null);
      }

      scheduleSelectionMeasure();
      return;
    }
  }

  function scheduleSelectionMeasure() {
    if (interactionActiveRef.current) return;
    if (measureRafRef.current !== null) {
      cancelAnimationFrame(measureRafRef.current);
    }
    measureRafRef.current = requestAnimationFrame(() => {
      measureRafRef.current = null;
      measureSelectionBox();
    });
  }

  function applyBoxToCard(card: HTMLElement, b: Box) {
    card.style.position  = "absolute";
    card.style.left      = `${b.left}px`;
    card.style.top       = `${b.top}px`;
    card.style.width     = `${b.width}px`;
    card.style.minHeight = `${b.height}px`;
    card.style.height    = `${b.height}px`;
    card.style.right     = "auto";
    card.style.bottom    = "auto";
    card.style.transform = "translate3d(0,0,0)";
    card.style.transition = "none";
  }

  function applyLiveResizeStyles(
    card: HTMLElement,
    nextBox: Box,
    initialBox: Box,
    targets: LiveResizeTargets,
  ) {
    const resize = getResizeStyleChanges(overlay, initialBox, nextBox);
    const stageScale = containerRef.current ? getStageScale(containerRef.current) : 1;

    card.style.maxWidth = `${Math.round(resize.styleChanges.maxWidth * stageScale)}px`;
    card.style.padding = `${Math.round(resize.backgroundChanges.paddingY * stageScale)}px ${Math.round(resize.backgroundChanges.paddingX * stageScale)}px`;
    card.style.borderRadius = `${Math.round(resize.backgroundChanges.radius * stageScale)}px`;

    if (targets.text) {
      targets.text.style.fontSize = `${Math.round(resize.styleChanges.fontSize * stageScale)}px`;
    }

    if (targets.media) {
      targets.media.style.maxWidth = `${Math.round(resize.mediaMaxWidth * stageScale)}px`;
      if (overlay.content.type === "icon") {
        targets.media.style.height = `${Math.round(resize.iconHeight * stageScale)}px`;
      } else if (overlay.content.type === "logo") {
        targets.media.style.height = `${Math.round(resize.logoHeight * stageScale)}px`;
      }
    }

    if (targets.actionLink) {
      targets.actionLink.style.fontSize = `${Math.round(resize.actionFontSize * stageScale)}px`;
      targets.actionLink.style.marginTop = `${Math.round(resize.actionMarginTop * stageScale)}px`;
      if (targets.isButtonLike) {
        targets.actionLink.style.padding = `${Math.round(resize.actionPaddingY * stageScale)}px ${Math.round(resize.actionPaddingX * stageScale)}px`;
      }
    }
  }

  function restoreCard(card: HTMLElement) {
    card.style.position  = "";
    card.style.left      = "";
    card.style.top       = "";
    card.style.width     = "";
    card.style.minHeight = "";
    card.style.height    = "";
    card.style.right     = "";
    card.style.bottom    = "";
    card.style.transform = "";
    card.style.transition = "";
  }

  // ── Bootstrap: read actual rendered card rect → box ─────────────────
  // Use getBoundingClientRect so the selection box matches exactly what
  // the user sees, including padding, scaled font, and auto-height.
  useEffect(() => {
    syncSelectionBox();
    return () => {
      if (measureRafRef.current !== null) {
        cancelAnimationFrame(measureRafRef.current);
        measureRafRef.current = null;
      }
    };
  }, [selectionIdentity, containerRef]);

  // ── Re-sync on container resize ───────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      scheduleSelectionMeasure();
    });
    resizeObserver.observe(container);
    for (const { card } of getSelectionCards()) {
      resizeObserver.observe(card);
    }

    const mutationObserver = new MutationObserver((mutations) => {
      const shouldRemeasure = mutations.some((mutation) => {
        if (mutation.type === "childList") {
          return true;
        }
        const target = mutation.target;
        return (
          target instanceof HTMLElement
          && (target.matches("[data-overlay-id]") || Boolean(target.closest("[data-overlay-id]")))
        );
      });
      if (shouldRemeasure) {
        scheduleSelectionMeasure();
      }
    });
    mutationObserver.observe(container, {
      subtree: true,
      attributes: true,
      childList: true,
      attributeFilter: ["style", "class", "data-state", "aria-hidden"],
    });

    window.addEventListener("resize", scheduleSelectionMeasure);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleSelectionMeasure);
    };
  }, [selectionIdentity, containerRef]);

  // ── After React renders the chrome, sync DOM to boxRef ────────────────
  // (Handles the rare case where state update and DOM apply get out of sync.)
  useEffect(() => {
    if (boxRef.current) applyBoxToDom(boxRef.current);
  });

  // ─── Core move function — called from both drag and resize onMove ─────
  function moveAll(next: Box, card: HTMLElement | null) {
    boxRef.current = next;
    // Card and chrome DOM writes are synchronous — zero React involvement.
    if (!isMultiSelection && card) applyBoxToCard(card, next);
    applyBoxToDom(next);
  }

  // ── Drag ──────────────────────────────────────────────────────────────

  function handleDragPointerDown(e: ReactPointerEvent) {
    const containerNode = containerRef.current;
    const startBox = boxRef.current;
    if (!containerNode || !startBox) return;
    const container: HTMLElement = containerNode;

    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Window listeners keep the drag alive when pointer capture is unavailable.
    }
    interactionActiveRef.current = true;
    setIsDragging(true);
    onInteractingChange?.(true);

    const initialBox: Box = startBox;
    const card = getCard();
    const selectionCards = getSelectionCards().map(({ overlayId, card: selectionCard }) => {
      const rect = selectionCard.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return {
        overlayId,
        card: selectionCard,
        box: {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: Math.max(rect.width, MIN_BOX_DIMENSION),
          height: Math.max(rect.height, MIN_BOX_DIMENSION),
        },
      };
    });
    moveAll(initialBox, card); // freeze card at pixel coords immediately

    const startX = e.clientX;
    const startY = e.clientY;
    const cRect = container.getBoundingClientRect();

    function onMove(ev: PointerEvent) {
      const next: Box = {
        ...initialBox,
        left: Math.max(0, Math.min(initialBox.left + ev.clientX - startX, cRect.width  - initialBox.width)),
        top:  Math.max(0, Math.min(initialBox.top  + ev.clientY - startY, cRect.height - initialBox.height)),
      };
      if (isMultiSelection) {
        const deltaX = next.left - initialBox.left;
        const deltaY = next.top - initialBox.top;
        for (const entry of selectionCards) {
          applyBoxToCard(entry.card, {
            ...entry.box,
            left: entry.box.left + deltaX,
            top: entry.box.top + deltaY,
          });
        }
      }
      moveAll(next, card);
    }

    function onUp() {
      cleanup();
      const nextBox = boxRef.current;
      if (!nextBox) {
        setIsDragging(false);
        interactionActiveRef.current = false;
        onInteractingChange?.(false);
        return;
      }
      if (isMultiSelection) {
        onMoveSelection?.({
          x: (nextBox.left - initialBox.left) / Math.max(cRect.width, 1),
          y: (nextBox.top - initialBox.top) / Math.max(cRect.height, 1),
        });
      } else {
        const nextLayout = boxToLayout(nextBox, overlay, container);
        onLayoutChange?.(
          {
            x: nextLayout.x,
            y: nextLayout.y,
          },
          { intent: "move", scaleX: 1, scaleY: 1 },
        );
      }
      // Keep card at final pixel position — the manifest-driven overlay-sync
      // effect in runtime-preview will restore fractional styles once committed.
      setBox(nextBox);
      setIsDragging(false);
      interactionActiveRef.current = false;
      onInteractingChange?.(false);
      scheduleSelectionMeasure();
    }

    function cleanup() {
      setIsDragging(false);
      interactionActiveRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  }

  // ── Resize ────────────────────────────────────────────────────────────

  function handleResizePointerDown(e: ReactPointerEvent, corner: Corner) {
    const containerNode = containerRef.current;
    const startBox = boxRef.current;
    if (!containerNode || !startBox) return;
    const container: HTMLElement = containerNode;

    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Window listeners keep the resize alive when pointer capture is unavailable.
    }
    interactionActiveRef.current = true;
    onInteractingChange?.(true);

    const initialBox: Box = startBox;
    const card = getCard();
    const resizeTargets = card ? getLiveResizeTargets(card, overlay) : null;
    moveAll(initialBox, card);

    const startX = e.clientX;
    const startY = e.clientY;
    const cRect = container.getBoundingClientRect();
    let latestClientX = startX;
    let latestClientY = startY;
    let resizeRaf: number | null = null;

    function applyResizeFrame(clientX: number, clientY: number) {
      const dx = clientX - startX;
      const dy = clientY - startY;
      let { left, top, width, height } = initialBox;

      if (corner === "nw") {
        const nl = Math.max(0, Math.min(left + dx, left + width - MIN_BOX_DIMENSION));
        const nt = Math.max(0, Math.min(top  + dy, top  + height - MIN_BOX_DIMENSION));
        width  += left - nl;
        height += top  - nt;
        left = nl; top = nt;
      } else if (corner === "ne") {
        const nt = Math.max(0, Math.min(top + dy, top + height - MIN_BOX_DIMENSION));
        height += top - nt; top = nt;
        width = Math.max(MIN_BOX_DIMENSION, Math.min(width + dx, cRect.width - left));
      } else if (corner === "sw") {
        const nl = Math.max(0, Math.min(left + dx, left + width - MIN_BOX_DIMENSION));
        width += left - nl; left = nl;
        height = Math.max(MIN_BOX_DIMENSION, Math.min(height + dy, cRect.height - top));
      } else {
        width  = Math.max(MIN_BOX_DIMENSION, Math.min(width  + dx, cRect.width  - left));
        height = Math.max(MIN_BOX_DIMENSION, Math.min(height + dy, cRect.height - top));
      }

      const nextBox = { left, top, width, height };
      moveAll(nextBox, card);
      if (card && resizeTargets) {
        applyLiveResizeStyles(card, nextBox, initialBox, resizeTargets);
      }
    }

    function onMove(ev: PointerEvent) {
      latestClientX = ev.clientX;
      latestClientY = ev.clientY;
      if (resizeRaf === null) {
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = null;
          applyResizeFrame(latestClientX, latestClientY);
        });
      }
    }

    function onUp() {
      if (resizeRaf !== null) {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = null;
      }
      applyResizeFrame(latestClientX, latestClientY);
      cleanup();
      const nextBox = boxRef.current;
      if (!nextBox) {
        interactionActiveRef.current = false;
        onInteractingChange?.(false);
        return;
      }
      const resize = getResizeStyleChanges(overlay, initialBox, nextBox);
      onLayoutChange?.(boxToLayout(nextBox, overlay, container), {
        intent: "resize",
        scaleX: resize.scaleX,
        scaleY: resize.scaleY,
        styleChanges: resize.styleChanges,
        backgroundChanges: resize.backgroundChanges,
      });
      setBox(nextBox);
      interactionActiveRef.current = false;
      onInteractingChange?.(false);
      scheduleSelectionMeasure();
    }

    function cleanup() {
      interactionActiveRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (resizeRaf !== null) {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = null;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (!box) return null;

  const metrics = getChromeViewportMetrics(box);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!metrics || !portalTarget) return null;

  const handles: { id: Corner; ref: RefObject<HTMLButtonElement | null>; cursor: string }[] = [
    { id: "nw", ref: handleNwRef, cursor: "nwse-resize" },
    { id: "ne", ref: handleNeRef, cursor: "nesw-resize" },
    { id: "sw", ref: handleSwRef, cursor: "nesw-resize" },
    { id: "se", ref: handleSeRef, cursor: "nwse-resize" },
  ];

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[2147483640]">
      {/* Selection outline — pointer-events:none so canvas clicks pass through */}
      <div
        ref={outlineRef}
        className="pointer-events-none fixed z-[2147483641]"
        style={{
          left: metrics.left,
          top: metrics.top,
          width: metrics.width,
          height: metrics.height,
          outline: "2px solid rgba(103,232,249,0.72)",
          outlineOffset: 2,
        }}
      />

      {allowLayoutEditing ? (
        <>
          {!isMultiSelection && overlay.content.type !== "group" ? (
            <>
              {/* Corner resize handles */}
              {handles.map(({ id, ref, cursor }) => {
                const isNorth = id[0] === "n";
                const isWest  = id[1] === "w";
                const label =
                  id === "nw"
                    ? "Resize overlay north west"
                    : id === "ne"
                      ? "Resize overlay north east"
                      : id === "sw"
                        ? "Resize overlay south west"
                        : "Resize overlay south east";
                return (
              <button
                key={id}
                ref={ref}
                type="button"
                data-overlay-selection-chrome
                onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => handleResizePointerDown(e, id)}
                className="pointer-events-auto fixed z-[2147483642] h-3 w-3 rounded-sm border-2 border-[rgba(103,232,249,0.9)] bg-[#0a1520]"
                aria-label={label}
                title={label}
                    style={{
                      left: isWest
                        ? metrics.left - CORNER_HANDLE_HALF
                        : metrics.left + metrics.width - CORNER_HANDLE_HALF,
                      top: isNorth
                        ? metrics.top - CORNER_HANDLE_HALF
                        : metrics.top + metrics.height - CORNER_HANDLE_HALF,
                      cursor,
                    }}
                  />
                );
              })}
            </>
          ) : null}

          <button
            ref={dragHandleRef}
            type="button"
            data-overlay-selection-chrome
            onPointerDown={handleDragPointerDown}
            className="focus-ring pointer-events-auto fixed z-[2147483642] flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
            style={{
              left: metrics.left + metrics.width - DRAG_HANDLE_SIZE - DRAG_HANDLE_OFFSET,
              top: metrics.top + DRAG_HANDLE_OFFSET,
              cursor: "grab",
              borderColor: isDragging ? "rgba(205,239,255,0.28)" : "rgba(255,255,255,0.06)",
              background: "rgba(10,12,18,0.96)",
              color: isDragging ? "var(--editor-accent)" : "var(--foreground-muted)",
            }}
            title="Drag overlay"
            aria-label="Drag overlay"
          >
            <Move className="h-3.5 w-3.5" />
          </button>
        </>
      ) : null}

      {/* Toolbar wrapper */}
      <div
        ref={toolbarWrapRef}
        data-overlay-selection-chrome
        className="pointer-events-none fixed z-[2147483643]"
        style={{ top: metrics.toolbarTop, left: metrics.toolbarLeft }}
      >
        <InlineTextToolbar
          position={{ top: 0, left: 0 }}
          maxWidth={metrics.maxToolbarWidth || undefined}
          fontFamily={selectedStyle?.fontFamily ?? "Inter"}
          fontWeight={selectedStyle?.fontWeight ?? 600}
          fontSize={selectedStyle?.fontSize ?? 34}
          color={selectedStyle?.color ?? "#f6f7fb"}
          opacity={selectedStyle?.opacity ?? 1}
          italic={selectedStyle?.italic ?? false}
          underline={selectedStyle?.underline ?? false}
          textAlign={(selectedStyle?.textAlign as "start" | "center" | "end") ?? "start"}
          isTextStyle={isTextStyle && !isMultiSelection}
          onLiveChange={isMultiSelection ? undefined : onStyleLiveChange}
          onChange={isMultiSelection ? undefined : onStyleChange}
          canGroup={isMultiSelection ? canGroupSelection : false}
          canUngroup={isMultiSelection ? canUngroupSelection : canUngroupSelection}
          onGroup={isMultiSelection ? onGroupSelection : undefined}
          onUngroup={isMultiSelection || canUngroupSelection ? onUngroupSelection : undefined}
          onDuplicate={isMultiSelection ? onDuplicateSelection : onDuplicate}
          onDelete={isMultiSelection ? onDeleteSelection : onDelete}
        />
      </div>
    </div>,
    portalTarget,
  );
}
