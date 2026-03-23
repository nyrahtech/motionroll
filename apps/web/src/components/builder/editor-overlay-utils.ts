import {
  clampProgress,
  normalizeTimingRange,
  type OverlayDefinition,
  type OverlayTransition,
} from "@motionroll/shared";
import type { HydratedOverlayDefinition } from "./editor-draft-types";

export const DESIGN_STAGE_WIDTH = 1440;
export const DESIGN_STAGE_HEIGHT = 810;

export type LayoutChangeOptions = {
  intent?: "move" | "resize";
  scaleX?: number;
  scaleY?: number;
  styleChanges?: Partial<NonNullable<OverlayDefinition["content"]["style"]>>;
  backgroundChanges?: Partial<NonNullable<OverlayDefinition["content"]["background"]>>;
};

export function buildOverlayId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function isGroupOverlay(overlay: Pick<OverlayDefinition, "content">) {
  return overlay.content.type === "group";
}

export function getRootOverlays<T extends { content: { parentGroupId?: string } }>(overlays: T[]) {
  return overlays.filter((o) => !o.content.parentGroupId);
}

export function getTopLayerIndex<T extends { content: { layer?: number; parentGroupId?: string } }>(overlays: T[]) {
  return getRootOverlays(overlays).reduce(
    (max, o) => Math.max(max, o.content.layer ?? 0),
    -1,
  );
}

export function getRequiredLayerCount<T extends { content: { layer?: number; parentGroupId?: string } }>(
  overlays: T[],
  requestedCount = 1,
) {
  return Math.max(1, requestedCount, getTopLayerIndex(overlays) + 1);
}

export function getOverlayById<T extends { id: string }>(overlays: T[], overlayId: string) {
  return overlays.find((o) => o.id === overlayId);
}

export function getDirectGroupChildren<T extends { id: string; content: { parentGroupId?: string } }>(
  overlays: T[],
  groupId: string,
) {
  return overlays.filter((o) => o.content.parentGroupId === groupId);
}

export function getRootOverlayId(
  overlays: Array<Pick<HydratedOverlayDefinition, "id" | "content">>,
  overlayId: string,
) {
  let current = getOverlayById(overlays, overlayId);
  while (current?.content.parentGroupId) {
    const parent = getOverlayById(overlays, current.content.parentGroupId);
    if (!parent) break;
    current = parent;
  }
  return current?.id ?? overlayId;
}

export function normalizeOverlayLayers<T extends { content: { layer?: number } }>(overlays: T[]) {
  return overlays.map((overlay, index) => {
    const sourceLayer = overlay.content.layer ?? Math.max(overlays.length - index - 1, 0);
    return {
      ...overlay,
      content: { ...overlay.content, layer: Math.max(0, sourceLayer) },
    };
  });
}

function normalizeTextHtml(input: unknown): string | undefined {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const legacy = input as { text?: string; eyebrow?: string; headline?: string; body?: string };
    const parts = [legacy.text, legacy.eyebrow, legacy.headline, legacy.body]
      .map((v) => v?.trim())
      .filter((v): v is string => Boolean(v));
    return parts.length > 0 ? parts.join("<br><br>") : undefined;
  }
  return undefined;
}

export function hydrateOverlay(overlay: OverlayDefinition): HydratedOverlayDefinition {
  return {
    ...overlay,
    content: {
      type: overlay.content.type ?? "text",
      text: overlay.content.text,
      cta: overlay.content.cta,
      align: overlay.content.align ?? "start",
      theme: overlay.content.theme ?? "light",
      treatment: overlay.content.treatment ?? "default",
      mediaUrl: overlay.content.mediaUrl,
      linkHref: overlay.content.linkHref,
      textHtml: normalizeTextHtml(overlay.content.textHtml),
      layer: overlay.content.layer ?? 0,
      layout: {
        x: overlay.content.layout?.x ?? 0.08,
        y: overlay.content.layout?.y ?? 0.12,
        width: overlay.content.layout?.width ?? 420,
        height: overlay.content.layout?.height,
      },
      style: {
        fontFamily: overlay.content.style?.fontFamily ?? "Inter",
        fontWeight: overlay.content.style?.fontWeight ?? 600,
        fontSize: overlay.content.style?.fontSize ?? 34,
        lineHeight: overlay.content.style?.lineHeight ?? 1.08,
        letterSpacing: overlay.content.style?.letterSpacing ?? 0,
        textAlign: overlay.content.style?.textAlign ?? overlay.content.align ?? "start",
        color: overlay.content.style?.color ?? "#f6f7fb",
        opacity: overlay.content.style?.opacity ?? 1,
        maxWidth: overlay.content.style?.maxWidth ?? overlay.content.layout?.width ?? 420,
        italic: overlay.content.style?.italic ?? false,
        underline: overlay.content.style?.underline ?? false,
        textTransform: overlay.content.style?.textTransform ?? "none",
        buttonLike: overlay.content.style?.buttonLike ?? false,
      },
      background: {
        enabled: overlay.content.background?.enabled ?? false,
        mode: overlay.content.background?.enabled ? "solid" : "transparent",
        color: overlay.content.background?.color ?? "#0d1016",
        opacity: overlay.content.background?.opacity ?? 0.82,
        radius: overlay.content.background?.radius ?? 14,
        paddingX: overlay.content.background?.paddingX ?? 18,
        paddingY: overlay.content.background?.paddingY ?? 14,
        borderColor: overlay.content.background?.borderColor ?? "#d6f6ff",
        borderOpacity: overlay.content.background?.borderOpacity ?? 0,
      },
      animation: {
        preset: overlay.content.animation?.preset ?? "fade",
        easing: overlay.content.animation?.easing ?? "ease-out",
        duration: overlay.content.animation?.duration ?? 0.45,
        delay: overlay.content.animation?.delay ?? 0,
      },
      transition: {
        preset: overlay.content.transition?.preset ?? "crossfade",
        easing: overlay.content.transition?.easing ?? "ease-in-out",
        duration: overlay.content.transition?.duration ?? 0.4,
      },
      parentGroupId: overlay.content.parentGroupId,
    },
  };
}

export function createDefaultOverlay(
  id: string,
  type: "text" | "image" | "logo" | "icon" | "moment" | "group",
  playhead: number,
  mediaUrl?: string,
): HydratedOverlayDefinition {
  const timing = normalizeTimingRange(
    {
      start: clampProgress(playhead - 0.06),
      end: clampProgress(playhead + 0.12),
    },
    0.08,
  );

  return {
    id,
    timing,
    content: {
      type: type === "moment" ? "text" : type,
      text:
        type === "image" || type === "logo" || type === "icon"
          ? undefined
          : type === "group"
          ? undefined
          : type === "moment"
          ? "Moment highlight"
          : "New text block",
      mediaUrl,
      align: "start",
      theme: "dark",
      treatment: "default",
      linkHref: undefined,
      layer: 0,
      layout: {
        x: 0.08,
        y: 0.12,
        width:
          type === "image"
            ? 360
            : type === "logo"
            ? 220
            : type === "icon"
            ? 180
            : type === "group"
            ? 480
            : 420,
        ...(type === "group" ? { height: 260 } : {}),
      },
      style: {
        fontFamily: "Inter",
        fontWeight: type === "moment" ? 700 : 600,
        fontSize: type === "moment" ? 40 : 34,
        lineHeight: 1.08,
        letterSpacing: 0,
        textAlign: "start",
        color: "#f6f7fb",
        opacity: 1,
        maxWidth: type === "image" ? 360 : type === "group" ? 480 : 420,
        italic: false,
        underline: false,
        textTransform: "none",
        buttonLike: false,
      },
      background: {
        enabled: false,
        mode: "solid",
        color: "#0d1016",
        opacity: 0.82,
        radius: 14,
        paddingX: type === "group" ? 0 : 18,
        paddingY: type === "group" ? 0 : 14,
        borderColor: "#d6f6ff",
        borderOpacity: 0,
      },
      animation: {
        preset: "fade",
        easing: "ease-out",
        duration: 0.45,
        delay: 0,
      },
      transition: {
        preset: "crossfade",
        easing: "ease-in-out",
        duration: 0.4,
      },
      parentGroupId: undefined,
    },
  };
}

export function estimateOverlayHeight(overlay: HydratedOverlayDefinition) {
  const explicitHeight = overlay.content.layout.height;
  if (typeof explicitHeight === "number") return explicitHeight;
  switch (overlay.content.type) {
    case "image": return 220;
    case "logo": return 80;
    case "icon": return 64;
    case "group": return 260;
    default: return 120;
  }
}

export function getOverlayAbsoluteBounds(overlay: HydratedOverlayDefinition) {
  const width = overlay.content.layout.width;
  const height = estimateOverlayHeight(overlay);
  const centerAligned = overlay.content.align === "center";
  const left =
    (overlay.content.layout.x ?? 0.08) -
    (centerAligned ? width / DESIGN_STAGE_WIDTH / 2 : 0);
  const top =
    (overlay.content.layout.y ?? 0.12) -
    (centerAligned ? height / DESIGN_STAGE_HEIGHT / 2 : 0);
  return {
    left,
    top,
    right: left + width / DESIGN_STAGE_WIDTH,
    bottom: top + height / DESIGN_STAGE_HEIGHT,
    width,
    height,
  };
}

export function shiftOverlayAbsoluteLayout(
  overlay: HydratedOverlayDefinition,
  deltaX: number,
  deltaY: number,
) {
  return {
    ...overlay,
    content: {
      ...overlay.content,
      layout: {
        ...overlay.content.layout,
        x: clampProgress((overlay.content.layout.x ?? 0.08) + deltaX),
        y: clampProgress((overlay.content.layout.y ?? 0.12) + deltaY),
      },
    },
  };
}

export function getGroupSelectionEligibility(
  overlays: HydratedOverlayDefinition[],
  overlayIds: string[],
) {
  if (overlayIds.length < 2) return false;
  return overlayIds.every((overlayId) => {
    const overlay = getOverlayById(overlays, overlayId);
    if (!overlay) return false;
    return !overlay.content.parentGroupId && !isGroupOverlay(overlay);
  });
}

export function duplicateRootOverlays(
  overlays: HydratedOverlayDefinition[],
  rootOverlayIds: string[],
) {
  const duplicatesBySource = new Map<string, HydratedOverlayDefinition[]>();
  const duplicateIds: string[] = [];

  for (const rootOverlayId of rootOverlayIds) {
    const source = getOverlayById(overlays, rootOverlayId);
    if (!source) continue;

    if (isGroupOverlay(source)) {
      const duplicateGroupId = buildOverlayId("copy");
      const groupChildren = getDirectGroupChildren(overlays, source.id);
      duplicateIds.push(duplicateGroupId);
      duplicatesBySource.set(rootOverlayId, [
        hydrateOverlay({
          ...source,
          id: duplicateGroupId,
          content: {
            ...source.content,
            layout: {
              ...source.content.layout,
              x: clampProgress((source.content.layout.x ?? 0.08) + 0.02),
              y: clampProgress((source.content.layout.y ?? 0.12) + 0.02),
            },
          },
        }),
        ...groupChildren.map((child) =>
          hydrateOverlay({
            ...child,
            id: buildOverlayId("copy"),
            content: {
              ...child.content,
              parentGroupId: duplicateGroupId,
              layout: {
                ...child.content.layout,
                x: clampProgress((child.content.layout.x ?? 0.08) + 0.02),
                y: clampProgress((child.content.layout.y ?? 0.12) + 0.02),
              },
            },
          }),
        ),
      ]);
      continue;
    }

    const duplicateId = buildOverlayId("copy");
    duplicateIds.push(duplicateId);
    duplicatesBySource.set(rootOverlayId, [
      hydrateOverlay({
        ...source,
        id: duplicateId,
        timing: normalizeTimingRange(
          {
            start: clampProgress(source.timing.start + 0.04),
            end: clampProgress(source.timing.end + 0.04),
          },
          0.08,
        ),
        content: {
          ...source.content,
          text: `${source.content.text ?? "Text block"} Copy`,
        },
      }),
    ]);
  }

  return {
    overlays: normalizeOverlayLayers(
      overlays.flatMap((overlay) => {
        const duplicates = duplicatesBySource.get(overlay.id);
        return duplicates ? [overlay, ...duplicates] : [overlay];
      }),
    ),
    duplicateIds,
  };
}

export function deleteRootOverlays(
  overlays: HydratedOverlayDefinition[],
  rootOverlayIds: string[],
) {
  const removedIds = new Set(rootOverlayIds);
  return normalizeOverlayLayers(
    overlays.filter((overlay) => {
      if (removedIds.has(overlay.id)) return false;
      if (overlay.content.parentGroupId && removedIds.has(overlay.content.parentGroupId)) return false;
      return true;
    }),
  );
}

export function reorderOverlayLayers<T extends { content: { layer?: number; parentGroupId?: string } }>(
  overlays: T[],
  layerCount: number,
  fromRow: number,
  toRow: number,
) {
  const distinctLayers = Array.from(
    { length: getRequiredLayerCount(overlays, layerCount) },
    (_, index) => index,
  ).sort((l, r) => r - l);

  if (
    fromRow < 0 ||
    toRow < 0 ||
    fromRow >= distinctLayers.length ||
    toRow >= distinctLayers.length ||
    fromRow === toRow
  ) {
    return normalizeOverlayLayers(overlays);
  }

  const nextRows = [...distinctLayers];
  const [moved] = nextRows.splice(fromRow, 1);
  if (typeof moved === "undefined") return normalizeOverlayLayers(overlays);
  nextRows.splice(toRow, 0, moved);

  const remappedLayers = new Map(
    nextRows.map((layer, index) => [layer, nextRows.length - index - 1]),
  );
  return normalizeOverlayLayers(
    overlays.map((overlay) => ({
      ...overlay,
      content: {
        ...overlay.content,
        layer: overlay.content.parentGroupId
          ? overlay.content.layer ?? 0
          : remappedLayers.get(overlay.content.layer ?? 0) ?? 0,
      },
    })),
  );
}

export function sanitizeOverlayForSave(overlay: HydratedOverlayDefinition): OverlayDefinition {
  const ctaLabel = overlay.content.cta?.label?.trim() ?? "";
  const ctaHref = overlay.content.cta?.href?.trim() ?? "";
  const linkHref = overlay.content.linkHref?.trim();
  const mediaUrl = overlay.content.mediaUrl?.trim();
  return {
    ...overlay,
    content: {
      ...overlay.content,
      mediaUrl: mediaUrl ? mediaUrl : undefined,
      linkHref: linkHref ? linkHref : undefined,
      cta: ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : undefined,
      layer: overlay.content.layer ?? 0,
    },
  };
}
