"use client";

/**
 * OverlayManipulator
 *
 * All moving parts — card, outline, 4 corner handles, drag handle,
 * toolbar wrapper — are moved via direct DOM style writes on every pointermove.
 * React state (box) only sets the initial position and the final committed
 * position after pointerup. Nothing goes through React's scheduler during
 * an active gesture, so movement is always synchronous with the pointer.
 */

import { useEffect, useRef, useState } from "react";
import type { RefObject, PointerEvent as ReactPointerEvent } from "react";
import { clampProgress } from "@motionroll/shared";
import type { OverlayDefinition } from "@motionroll/shared";
import { Move } from "lucide-react";
import { InlineTextToolbar } from "./inline-text-toolbar";

// ─── Constants ────────────────────────────────────────────────────────────────

const DESIGN_WIDTH = 1440;
const DESIGN_HEIGHT = 810;
const MIN_DIM = 80;
const HANDLE_HALF = 6; // half of 12px handle size
const DRAG_HANDLE_OFFSET = 8;
const DRAG_HANDLE_SIZE = 32;

// ─── Types ────────────────────────────────────────────────────────────────────

type Box = { left: number; top: number; width: number; height: number };
type Corner = "nw" | "ne" | "sw" | "se";
type LiveResizeTargets = {
  text: HTMLElement | null;
  media: HTMLElement | null;
  actionLink: HTMLElement | null;
  isButtonLike: boolean;
};

export type OverlayManipulatorProps = {
  overlay: OverlayDefinition;
  selectedOverlayId: string;
  selectedOverlayIds?: string[];
  selectionOverlays?: OverlayDefinition[];
  containerRef: RefObject<HTMLElement | null>;
  selectedStyle?: OverlayDefinition["content"]["style"];
  isTextStyle: boolean;
  allowLayoutEditing?: boolean;
  onLayoutChange: (
    layout: Partial<{ x: number; y: number; width: number; height: number }>,
    options?: {
      intent?: "move" | "resize";
      scaleX?: number;
      scaleY?: number;
      styleChanges?: Partial<NonNullable<OverlayDefinition["content"]["style"]>>;
      backgroundChanges?: Partial<NonNullable<OverlayDefinition["content"]["background"]>>;
    },
  ) => void;
  onStyleChange: (changes: Record<string, unknown>) => void;
  onEdit: () => void;
  canGroupSelection?: boolean;
  canUngroupSelection?: boolean;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveSelection?: (delta: { x: number; y: number }) => void;
  onDuplicateSelection?: () => void;
  onDeleteSelection?: () => void;
  onInteractingChange: (active: boolean) => void;
};

// ─── Coordinate helpers ────────────────────────────────────────────────────────

function getStageScale(container: HTMLElement): number {
  return Math.max(
    0.35,
    Math.min(
      container.clientWidth / DESIGN_WIDTH,
      container.clientHeight / DESIGN_HEIGHT,
    ),
  );
}

function overlayToBox(overlay: OverlayDefinition, container: HTMLElement, renderedHeight: number): Box {
  const layout = overlay.content.layout;
  const cW = container.clientWidth;
  const cH = container.clientHeight;
  const scale = getStageScale(container);
  const w = Math.round((layout?.width ?? 420) * scale);
  const h = renderedHeight;

  if (overlay.content.align === "center") {
    return {
      left: (layout?.x ?? 0.5) * cW - w / 2,
      top:  (layout?.y ?? 0.5) * cH - h / 2,
      width: w,
      height: h,
    };
  }
  return {
    left: (layout?.x ?? 0.08) * cW,
    top:  (layout?.y ?? 0.12) * cH,
    width: w,
    height: h,
  };
}

function unionBoxes(boxes: Box[]): Box | null {
  if (boxes.length === 0) {
    return null;
  }
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return {
    left,
    top,
    width: Math.max(MIN_DIM, right - left),
    height: Math.max(MIN_DIM, bottom - top),
  };
}

function boxToLayout(box: Box, overlay: OverlayDefinition, container: HTMLElement) {
  const cW = Math.max(container.clientWidth, 1);
  const cH = Math.max(container.clientHeight, 1);
  const scale = getStageScale(container);
  const center = overlay.content.align === "center";
  return {
    x: clampProgress(center ? (box.left + box.width / 2) / cW : box.left / cW),
    y: clampProgress(center ? (box.top + box.height / 2) / cH : box.top / cH),
    width: Math.round(box.width / scale),
    height: Math.round(box.height / scale),
  };
}

function toolbarPos(box: Box, cW: number, cH: number) {
  const tbW = 320;
  const tbH = 44;
  const left = Math.max(8, Math.min(box.left, cW - tbW - 8));
  const aboveTop = box.top - tbH - 8;
  const belowTop = box.top + box.height + 8;
  const top = aboveTop >= 8 ? aboveTop : Math.min(belowTop, cH - tbH - 8);
  return { top, left };
}

function clampScale(value: number, min = 0.5, max = 3) {
  return Math.max(min, Math.min(value, max));
}

function getResizeStyleChanges(
  overlay: OverlayDefinition,
  initialBox: Box,
  nextBox: Box,
) {
  const baseStyle = overlay.content.style;
  const baseBackground = overlay.content.background;
  const baseLayout = overlay.content.layout;
  const scaleX = initialBox.width > 0 ? nextBox.width / initialBox.width : 1;
  const scaleY = initialBox.height > 0 ? nextBox.height / initialBox.height : 1;
  const areaScale = Math.sqrt(scaleX * scaleY);
  const contentScale = clampScale(1 + (areaScale - 1) * 0.82);
  const paddingScaleX = clampScale(1 + (scaleX - 1) * 0.72);
  const paddingScaleY = clampScale(1 + (scaleY - 1) * 0.72);

  return {
    scaleX,
    scaleY,
    styleChanges: {
      fontSize: Math.max(10, Math.round((baseStyle?.fontSize ?? 34) * contentScale)),
      maxWidth: Math.max(80, Math.round((baseStyle?.maxWidth ?? baseLayout?.width ?? 420) * scaleX)),
    },
    backgroundChanges: {
      radius: Math.max(0, Math.round((baseBackground?.radius ?? 14) * contentScale)),
      paddingX: Math.max(0, Math.round((baseBackground?.paddingX ?? 18) * paddingScaleX)),
      paddingY: Math.max(0, Math.round((baseBackground?.paddingY ?? 14) * paddingScaleY)),
    },
    mediaMaxWidth: Math.max(80, Math.round((baseLayout?.width ?? 420) * scaleX)),
    iconHeight: Math.max(20, Math.round(64 * contentScale)),
    logoHeight: Math.max(24, Math.round(80 * contentScale)),
    actionFontSize: Math.max(10, Math.round(14 * contentScale)),
    actionMarginTop: Math.max(8, Math.round(16 * contentScale)),
    actionPaddingY: Math.max(6, Math.round(9 * paddingScaleY)),
    actionPaddingX: Math.max(8, Math.round(14 * paddingScaleX)),
  };
}

function getLiveResizeTargets(card: HTMLElement, overlay: OverlayDefinition): LiveResizeTargets {
  return {
    text: card.querySelector<HTMLElement>('[data-text-field="text"]'),
    media: card.querySelector<HTMLElement>("[data-media-field='media']"),
    actionLink: card.querySelector<HTMLElement>("a"),
    isButtonLike: Boolean(overlay.content.style?.buttonLike),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ── DOM refs for all chrome elements ──────────────────────────────────
  const outlineRef   = useRef<HTMLDivElement | null>(null);
  const handleNwRef  = useRef<HTMLDivElement | null>(null);
  const handleNeRef  = useRef<HTMLDivElement | null>(null);
  const handleSwRef  = useRef<HTMLDivElement | null>(null);
  const handleSeRef  = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  const toolbarWrapRef = useRef<HTMLDivElement | null>(null);
  const selectionIds = (selectedOverlayIds?.length ? selectedOverlayIds : [selectedOverlayId]).filter(Boolean);
  const selectionCardIds = (selectionOverlays?.length
    ? selectionOverlays.map((item) => item.id)
    : selectionIds
  ).filter(Boolean);
  const isMultiSelection = selectionIds.length > 1;

  // ── Apply box to all DOM elements synchronously ───────────────────────
  function applyBoxToDom(b: Box) {
    const cW = containerRef.current?.clientWidth ?? 0;
    const cH = containerRef.current?.clientHeight ?? 0;

    // Outline
    if (outlineRef.current) {
      const s = outlineRef.current.style;
      s.left   = `${b.left}px`;
      s.top    = `${b.top}px`;
      s.width  = `${b.width}px`;
      s.height = `${b.height}px`;
    }

    // Handles
    if (handleNwRef.current) {
      handleNwRef.current.style.left = `${b.left - HANDLE_HALF}px`;
      handleNwRef.current.style.top  = `${b.top  - HANDLE_HALF}px`;
    }
    if (handleNeRef.current) {
      handleNeRef.current.style.left = `${b.left + b.width - HANDLE_HALF}px`;
      handleNeRef.current.style.top  = `${b.top  - HANDLE_HALF}px`;
    }
    if (handleSwRef.current) {
      handleSwRef.current.style.left = `${b.left - HANDLE_HALF}px`;
      handleSwRef.current.style.top  = `${b.top  + b.height - HANDLE_HALF}px`;
    }
    if (handleSeRef.current) {
      handleSeRef.current.style.left = `${b.left + b.width - HANDLE_HALF}px`;
      handleSeRef.current.style.top  = `${b.top  + b.height - HANDLE_HALF}px`;
    }

    if (dragHandleRef.current) {
      dragHandleRef.current.style.left = `${b.left + b.width - DRAG_HANDLE_SIZE - DRAG_HANDLE_OFFSET}px`;
      dragHandleRef.current.style.top = `${b.top + DRAG_HANDLE_OFFSET}px`;
    }

    // Toolbar wrapper
    if (toolbarWrapRef.current && cW && cH) {
      const tb = toolbarPos(b, cW, cH);
      // InlineTextToolbar clamps position to min 8, so offset wrapper by -8 to compensate.
      toolbarWrapRef.current.style.left = `${tb.left - 8}px`;
      toolbarWrapRef.current.style.top  = `${tb.top  - 8}px`;
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
        return card ? { overlayId, card } : null;
      })
      .filter((entry): entry is { overlayId: string; card: HTMLElement } => Boolean(entry));
  }

  function getSelectionBox(container: HTMLElement): Box | null {
    const cRect = container.getBoundingClientRect();
    const cardBoxes = getSelectionCards().map(({ card }) => {
      const rect = card.getBoundingClientRect();
      return {
        left: rect.left - cRect.left,
        top: rect.top - cRect.top,
        width: Math.max(rect.width, MIN_DIM),
        height: Math.max(rect.height, MIN_DIM),
      };
    });
    if (cardBoxes.length > 0) {
      return unionBoxes(cardBoxes);
    }

    const overlays = selectionOverlays?.length ? selectionOverlays : [overlay];
    return unionBoxes(
      overlays.map((item) => overlayToBox(item, container, boxRef.current?.height ?? 100)),
    );
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
    const container = containerRef.current;
    if (!container) return;

    const initial = getSelectionBox(container);
    if (initial) {
      boxRef.current = initial;
      setBox(initial);
    } else {
      const fallback = overlayToBox(overlay, container, boxRef.current?.height ?? 100);
      boxRef.current = fallback;
      setBox(fallback);
    }
  }, [overlay, selectedOverlayId, selectedOverlayIds, selectionOverlays, containerRef]);

  // ── Re-sync on container resize ───────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const next = getSelectionBox(container);
      if (next) {
        boxRef.current = next;
        setBox(next);
      } else {
        const next = overlayToBox(overlay, container, boxRef.current?.height ?? 100);
        boxRef.current = next;
        setBox(next);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [overlay, selectedOverlayId, selectedOverlayIds, selectionOverlays, containerRef]);

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
    setIsDragging(true);
    onInteractingChange(true);

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
          width: Math.max(rect.width, MIN_DIM),
          height: Math.max(rect.height, MIN_DIM),
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
        onInteractingChange(false);
        return;
      }
      if (isMultiSelection) {
        onMoveSelection?.({
          x: (nextBox.left - initialBox.left) / Math.max(cRect.width, 1),
          y: (nextBox.top - initialBox.top) / Math.max(cRect.height, 1),
        });
      } else {
        onLayoutChange(boxToLayout(nextBox, overlay, container), { intent: "move", scaleX: 1, scaleY: 1 });
      }
      // Keep card at final pixel position — the manifest-driven overlay-sync
      // effect in runtime-preview will restore fractional styles once committed.
      setBox(nextBox);
      setIsDragging(false);
      onInteractingChange(false);
    }

    function cleanup() {
      setIsDragging(false);
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
    }

    document.body.style.userSelect = "none";
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
    onInteractingChange(true);

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
        const nl = Math.max(0, Math.min(left + dx, left + width - MIN_DIM));
        const nt = Math.max(0, Math.min(top  + dy, top  + height - MIN_DIM));
        width  += left - nl;
        height += top  - nt;
        left = nl; top = nt;
      } else if (corner === "ne") {
        const nt = Math.max(0, Math.min(top + dy, top + height - MIN_DIM));
        height += top - nt; top = nt;
        width = Math.max(MIN_DIM, Math.min(width + dx, cRect.width - left));
      } else if (corner === "sw") {
        const nl = Math.max(0, Math.min(left + dx, left + width - MIN_DIM));
        width += left - nl; left = nl;
        height = Math.max(MIN_DIM, Math.min(height + dy, cRect.height - top));
      } else {
        width  = Math.max(MIN_DIM, Math.min(width  + dx, cRect.width  - left));
        height = Math.max(MIN_DIM, Math.min(height + dy, cRect.height - top));
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
        onInteractingChange(false);
        return;
      }
      const resize = getResizeStyleChanges(overlay, initialBox, nextBox);
      onLayoutChange(boxToLayout(nextBox, overlay, container), {
        intent: "resize",
        scaleX: resize.scaleX,
        scaleY: resize.scaleY,
        styleChanges: resize.styleChanges,
        backgroundChanges: resize.backgroundChanges,
      });
      setBox(nextBox);
      onInteractingChange(false);
    }

    function cleanup() {
      document.body.style.userSelect = "";
      if (resizeRaf !== null) {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = null;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (!box) return null;

  const cW = containerRef.current?.clientWidth  ?? 0;
  const cH = containerRef.current?.clientHeight ?? 0;
  const tb = toolbarPos(box, cW, cH);

  const handles: { id: Corner; ref: RefObject<HTMLDivElement | null>; cursor: string }[] = [
    { id: "nw", ref: handleNwRef, cursor: "nwse-resize" },
    { id: "ne", ref: handleNeRef, cursor: "nesw-resize" },
    { id: "sw", ref: handleSwRef, cursor: "nesw-resize" },
    { id: "se", ref: handleSeRef, cursor: "nwse-resize" },
  ];

  return (
    <>
      {/* Selection outline — pointer-events:none so canvas clicks pass through */}
      <div
        ref={outlineRef}
        className="pointer-events-none absolute z-[30]"
        style={{
          left: box.left, top: box.top, width: box.width, height: box.height,
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
                return (
              <div
                key={id}
                ref={ref}
                data-overlay-selection-chrome
                onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => handleResizePointerDown(e, id)}
                className="absolute z-[34] h-3 w-3 rounded-sm border-2 border-[rgba(103,232,249,0.9)] bg-[#0a1520]"
                    style={{
                      left: isWest  ? box.left - HANDLE_HALF : box.left + box.width  - HANDLE_HALF,
                      top:  isNorth ? box.top  - HANDLE_HALF : box.top  + box.height - HANDLE_HALF,
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
            className="focus-ring absolute z-[34] flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
            style={{
              left: box.left + box.width - DRAG_HANDLE_SIZE - DRAG_HANDLE_OFFSET,
              top: box.top + DRAG_HANDLE_OFFSET,
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
        className="absolute z-[35]"
        style={{ top: tb.top - 8, left: tb.left - 8 }}
      >
        <InlineTextToolbar
          position={{ top: 0, left: 0 }}
          maxWidth={cW || undefined}
          fontFamily={selectedStyle?.fontFamily ?? "Inter"}
          fontWeight={selectedStyle?.fontWeight ?? 600}
          fontSize={selectedStyle?.fontSize ?? 34}
          color={selectedStyle?.color ?? "#f6f7fb"}
          italic={selectedStyle?.italic ?? false}
          underline={selectedStyle?.underline ?? false}
          textAlign={(selectedStyle?.textAlign as "start" | "center" | "end") ?? "start"}
          isTextStyle={isTextStyle && !isMultiSelection}
          onChange={isMultiSelection ? undefined : onStyleChange}
          canGroup={isMultiSelection ? canGroupSelection : false}
          canUngroup={isMultiSelection ? canUngroupSelection : canUngroupSelection}
          onGroup={isMultiSelection ? onGroupSelection : undefined}
          onUngroup={isMultiSelection || canUngroupSelection ? onUngroupSelection : undefined}
          onDuplicate={isMultiSelection ? onDuplicateSelection : onDuplicate}
          onDelete={isMultiSelection ? onDeleteSelection : onDelete}
        />
      </div>
    </>
  );
}
