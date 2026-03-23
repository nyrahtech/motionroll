/**
 * useOverlayCallbacks — stable callback handlers for overlay field, style,
 * animation and transition changes. Extracted from project-builder to keep
 * the render tree clean and avoid re-creating closures on every render.
 */
import { useCallback } from "react";
import {
  normalizeTimingRange,
  type OverlayDefinition,
} from "@motionroll/shared";
import type { HydratedOverlayDefinition } from "../editor-draft-types";
import {
  getOverlayById,
  hydrateOverlay,
  isGroupOverlay,
  shiftOverlayAbsoluteLayout,
  type LayoutChangeOptions,
} from "../editor-overlay-utils";
import type { UseEditorDraftReturn } from "./useEditorDraft";

type UpdateDraft = UseEditorDraftReturn["updateDraft"];
type UpdateSelectedOverlay = UseEditorDraftReturn["updateSelectedOverlay"];
type HandleOverlayStyleQuickChange = UseEditorDraftReturn["handleOverlayStyleQuickChange"];

export function useOverlayCallbacks({
  selectedOverlayId,
  updateDraft,
  updateSelectedOverlay,
  handleOverlayStyleQuickChange,
}: {
  selectedOverlayId: string;
  updateDraft: UpdateDraft;
  updateSelectedOverlay: UpdateSelectedOverlay;
  handleOverlayStyleQuickChange: HandleOverlayStyleQuickChange;
}) {
  const onOverlayFieldChange = useCallback(
    (field: string, value: unknown) => {
      if (!selectedOverlayId) return;
      updateSelectedOverlay(selectedOverlayId, (overlay) => {
        const hydrated = hydrateOverlay(overlay);
        const nextTiming =
          field === "start" || field === "end"
            ? normalizeTimingRange(
                {
                  start: field === "start" ? Number(value) : hydrated.timing.start,
                  end: field === "end" ? Number(value) : hydrated.timing.end,
                },
                0.04,
              )
            : hydrated.timing;
        return {
          ...hydrated,
          timing: nextTiming,
          content: {
            ...hydrated.content,
            text: field === "text" ? String(value) : hydrated.content.text,
            mediaUrl: field === "mediaUrl" ? String(value) : hydrated.content.mediaUrl,
            linkHref: field === "linkHref" ? String(value) : hydrated.content.linkHref,
            align:
              field === "align"
                ? (value as OverlayDefinition["content"]["align"])
                : hydrated.content.align,
            type:
              field === "type"
                ? (value as HydratedOverlayDefinition["content"]["type"])
                : hydrated.content.type,
            cta:
              field === "ctaLabel" || field === "ctaHref"
                ? {
                    label: field === "ctaLabel" ? String(value) : hydrated.content.cta?.label ?? "",
                    href: field === "ctaHref" ? String(value) : hydrated.content.cta?.href ?? "",
                  }
                : hydrated.content.cta,
          },
        };
      });
    },
    [selectedOverlayId, updateSelectedOverlay],
  );

  const onOverlayStyleChange = useCallback(
    (field: string, value: unknown) => {
      if (!selectedOverlayId) return;
      updateSelectedOverlay(selectedOverlayId, (overlay) => {
        const hydrated = hydrateOverlay(overlay);
        const nextBg = {
          ...hydrated.content.background,
          enabled: field === "backgroundEnabled" ? Boolean(value) : hydrated.content.background.enabled,
          color: field === "backgroundColor" ? String(value) : hydrated.content.background.color,
          opacity: field === "backgroundOpacity" ? Number(value) : hydrated.content.background.opacity,
          radius: field === "backgroundRadius" ? Number(value) : hydrated.content.background.radius,
          paddingX: field === "backgroundPaddingX" ? Number(value) : hydrated.content.background.paddingX,
          paddingY: field === "backgroundPaddingY" ? Number(value) : hydrated.content.background.paddingY,
          borderColor: field === "backgroundBorderColor" ? String(value) : hydrated.content.background.borderColor,
          borderOpacity: field === "backgroundBorderOpacity" ? Number(value) : hydrated.content.background.borderOpacity,
        };
        const bgEnabled =
          field === "backgroundEnabled" ? Boolean(value)
          : field === "backgroundOpacity" ? Number(value) > 0
          : field === "backgroundColor" ? nextBg.opacity > 0
          : hydrated.content.background.enabled;
        return {
          ...hydrated,
          content: {
            ...hydrated.content,
            style:
              field === "width" || field === "height" || field === "x" || field === "y"
                ? hydrated.content.style
                : { ...hydrated.content.style, ...(field === "layer" ? {} : { [field]: value }) },
            background: { ...nextBg, enabled: bgEnabled, mode: bgEnabled ? "solid" : "transparent" },
            layout:
              field === "width" || field === "height" || field === "x" || field === "y"
                ? { ...hydrated.content.layout, [field]: Number(value) }
                : hydrated.content.layout,
          },
        };
      });
    },
    [selectedOverlayId, updateSelectedOverlay],
  );

  const onOverlayStyleLiveChange = useCallback(
    (field: string, value: unknown) => {
      if (!selectedOverlayId) return;
      handleOverlayStyleQuickChange(selectedOverlayId, { [field]: value });
    },
    [selectedOverlayId, handleOverlayStyleQuickChange],
  );

  const onOverlayAnimationChange = useCallback(
    (field: string, value: unknown) => {
      if (!selectedOverlayId) return;
      updateSelectedOverlay(selectedOverlayId, (overlay) => {
        const hydrated = hydrateOverlay(overlay);
        return {
          ...hydrated,
          content: {
            ...hydrated.content,
            animation: { ...hydrated.content.animation, [field]: value },
          },
        };
      });
    },
    [selectedOverlayId, updateSelectedOverlay],
  );

  const onOverlayTransitionChange = useCallback(
    (field: string, value: unknown) => {
      if (!selectedOverlayId) return;
      updateSelectedOverlay(selectedOverlayId, (overlay) => {
        const hydrated = hydrateOverlay(overlay);
        return {
          ...hydrated,
          content: {
            ...hydrated.content,
            transition: { ...hydrated.content.transition, [field]: value },
          },
        };
      });
    },
    [selectedOverlayId, updateSelectedOverlay],
  );


  const onOverlayLayoutChange = useCallback(
    (
      overlayId: string,
      layout: Partial<{ x: number; y: number; width: number; height: number }>,
      options?: LayoutChangeOptions,
    ) => {
      updateDraft((current) => {
        const target = getOverlayById(current.overlays, overlayId);
        if (!target || target.content.parentGroupId) return current;
        const hydratedTarget = hydrateOverlay(target);
        const previousLayout = hydratedTarget.content.layout;
        const nextLayout = { ...previousLayout, ...layout };

        const buildUpdated = (overlay: HydratedOverlayDefinition) => {
          if (options?.intent !== "resize") {
            return { ...overlay, content: { ...overlay.content, layout: nextLayout } };
          }
          const scaleX = Math.max(0.35, Math.min(options.scaleX ?? 1, 4));
          const scaleY = Math.max(0.35, Math.min(options.scaleY ?? 1, 4));
          const areaScale = Math.sqrt(scaleX * scaleY);
          const contentScale = Math.max(0.5, Math.min(1 + (areaScale - 1) * 0.82, 3));
          return {
            ...overlay,
            content: {
              ...overlay.content,
              layout: nextLayout,
              style: {
                ...overlay.content.style,
                fontSize: Math.max(10, Math.round(overlay.content.style.fontSize * contentScale)),
                maxWidth: Math.max(80, Math.round((overlay.content.style.maxWidth ?? nextLayout.width ?? 420) * scaleX)),
              },
              background: {
                ...overlay.content.background,
                radius: Math.max(0, Math.round(overlay.content.background.radius * contentScale)),
                paddingX: Math.max(0, Math.round(overlay.content.background.paddingX * Math.max(0.5, Math.min(1 + (scaleX - 1) * 0.72, 3)))),
                paddingY: Math.max(0, Math.round(overlay.content.background.paddingY * Math.max(0.5, Math.min(1 + (scaleY - 1) * 0.72, 3)))),
              },
            },
          };
        };

        const deltaX = (nextLayout.x ?? previousLayout?.x ?? 0) - (previousLayout?.x ?? 0);
        const deltaY = (nextLayout.y ?? previousLayout?.y ?? 0) - (previousLayout?.y ?? 0);
        return {
          ...current,
          overlays: current.overlays.map((overlay) => {
            if (overlay.id === overlayId) return buildUpdated(hydrateOverlay(overlay));
            if (options?.intent !== "resize" && isGroupOverlay(hydratedTarget) && overlay.content.parentGroupId === overlayId)
              return shiftOverlayAbsoluteLayout(hydrateOverlay(overlay), deltaX, deltaY);
            return overlay;
          }),
        };
      });
    },
    [updateDraft],
  );

  const onInlineTextChange = useCallback(
    (overlayId: string, field: string, value: string, htmlValue?: string) => {
      updateDraft((current) => ({
        ...current,
        overlays: current.overlays.map((overlay) =>
          overlay.id === overlayId
            ? { ...overlay, content: { ...overlay.content, [field]: value, textHtml: htmlValue || undefined } }
            : overlay,
        ),
      }));
    },
    [updateDraft],
  );

  return {
    onOverlayFieldChange,
    onOverlayStyleChange,
    onOverlayStyleLiveChange,
    onOverlayAnimationChange,
    onOverlayTransitionChange,
    onOverlayLayoutChange,
    onInlineTextChange,
  };
}
