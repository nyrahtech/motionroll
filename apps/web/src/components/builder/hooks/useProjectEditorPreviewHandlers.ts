"use client";

import { useCallback } from "react";
import type { ProjectDraftDocument } from "@motionroll/shared";
import { getDefaultTextStyle } from "../project-builder-restored.helpers";

type LayerUpdateFn = (
  overlayId: string,
  updater: (
    layer: ProjectDraftDocument["layers"][number],
  ) => ProjectDraftDocument["layers"][number],
) => void;

type UseProjectEditorPreviewHandlersArgs = {
  updateLayer: LayerUpdateFn;
  setSelectedBookmarkId: (value: string) => void;
  setSelectedLayerId: (value: string) => void;
};

export function useProjectEditorPreviewHandlers({
  updateLayer,
  setSelectedBookmarkId,
  setSelectedLayerId,
}: UseProjectEditorPreviewHandlersArgs) {
  const handleSelectOverlay = useCallback((overlayId: string) => {
    setSelectedLayerId(overlayId);
    setSelectedBookmarkId("");
  }, [setSelectedBookmarkId, setSelectedLayerId]);

  const handleOverlayLayoutChange = useCallback((
    overlayId: string,
    layout: Partial<{ x: number; y: number; width: number; height: number }>,
    options?: {
      intent?: "move" | "resize";
      scaleX?: number;
      scaleY?: number;
      styleChanges?: Record<string, unknown>;
      backgroundChanges?: Record<string, unknown>;
    },
  ) => {
    updateLayer(overlayId, (layer) => ({
      ...layer,
      content: {
        ...layer.content,
        layout: {
          x: layer.content.layout?.x ?? 0.08,
          y: layer.content.layout?.y ?? 0.12,
          width: layer.content.layout?.width ?? 420,
          ...layer.content.layout,
          ...layout,
        },
        ...(options?.styleChanges ? {
          style: { ...getDefaultTextStyle(), ...layer.content.style, ...options.styleChanges },
        } : {}),
        ...(options?.backgroundChanges ? {
          background: {
            enabled: false,
            mode: "transparent",
            color: "#0d1016",
            opacity: 0,
            radius: 0,
            paddingX: 0,
            paddingY: 0,
            borderColor: "#d6f6ff",
            borderOpacity: 0,
            ...layer.content.background,
            ...options.backgroundChanges,
          },
        } : {}),
      },
    }));
  }, [updateLayer]);

  const handleInlineTextChange = useCallback((
    overlayId: string,
    _field: "text",
    value: string,
    htmlValue?: string,
  ) => {
    updateLayer(overlayId, (layer) => ({
      ...layer,
      content: {
        ...layer.content,
        text: value,
        textHtml: htmlValue,
      },
    }));
  }, [updateLayer]);

  const applyStyleChange = useCallback((overlayId: string, changes: Record<string, unknown>) => {
    updateLayer(overlayId, (layer) => ({
      ...layer,
      content: {
        ...layer.content,
        style: { ...getDefaultTextStyle(), ...layer.content.style, ...changes },
      },
    }));
  }, [updateLayer]);

  return {
    handleInlineTextChange,
    handleOverlayLayoutChange,
    handleOverlayStyleChange: applyStyleChange,
    handleOverlayStyleLiveChange: applyStyleChange,
    handleSelectOverlay,
  };
}
