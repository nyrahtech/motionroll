"use client";

import {
  clampProgress,
  type OverlayDefinition,
  type OverlayStyle,
  type ProjectDraftDocument,
  type ProjectManifest,
} from "@motionroll/shared";
import { normalizeFrameRange } from "../../lib/manifest-helpers";
import {
  getOverlayMediaMetadataFromAsset,
  getRenderableAssetPreview,
} from "../../lib/project-assets";
import {
  buildProjectDraftDocument,
  parseProjectDraftDocument,
  serializeProjectDraftDocument,
} from "../../lib/project-draft";
import type { EditorContainerProps } from "./editor-types";
import type { TimelineSelection, TimelineTrackModel } from "./timeline-model";

export const DEFAULT_BOOKMARK_TITLE = "Section";
export const DEFAULT_LAYER_SPAN = 0.18;
export const MIN_LAYER_SPAN = 0.02;
export const SAVE_DEBOUNCE_MS = 900;

export type SaveState = "saved" | "dirty" | "saving" | "error";

export type ProjectAssetWithVariants = EditorContainerProps["project"]["assets"][number] & {
  variants?: Array<{
    kind: string;
    publicUrl: string;
    storageKey?: string;
    metadata?: unknown;
  }>;
};

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.round(Math.random() * 1_000_000)}`;
}

export function clampUnit(value: number) {
  return clampProgress(Number.isFinite(value) ? value : 0);
}

export function normalizeTiming(start: number, end: number) {
  const nextStart = clampUnit(Math.min(start, end));
  const nextEnd = clampUnit(Math.max(end, nextStart + MIN_LAYER_SPAN));
  if (nextEnd - nextStart < MIN_LAYER_SPAN) {
    return {
      start: nextStart,
      end: clampUnit(nextStart + MIN_LAYER_SPAN),
    };
  }
  return {
    start: nextStart,
    end: nextEnd,
  };
}

export function sortBookmarks(bookmarks: ProjectDraftDocument["bookmarks"]) {
  return [...bookmarks].sort((left, right) => left.position - right.position);
}

export function sortLayers(layers: ProjectDraftDocument["layers"]) {
  return [...layers].sort(
    (left, right) =>
      (left.content.layer ?? 0) - (right.content.layer ?? 0) || left.id.localeCompare(right.id),
  );
}

export function reindexLayers(layers: OverlayDefinition[]) {
  return layers.map((layer, index) => ({
    ...layer,
    content: {
      ...layer.content,
      layer: index,
    },
  }));
}

export function normalizeBookmarks(bookmarks: ProjectDraftDocument["bookmarks"]) {
  const nextBookmarks = sortBookmarks(
    bookmarks.map((bookmark, index) => ({
      ...bookmark,
      id: bookmark.id || createId("bookmark"),
      title: bookmark.title?.trim() || `${DEFAULT_BOOKMARK_TITLE} ${index + 1}`,
      position: clampUnit(bookmark.position),
    })),
  );

  if (nextBookmarks.length > 0) {
    return nextBookmarks;
  }

  return [
    {
      id: createId("bookmark"),
      title: `${DEFAULT_BOOKMARK_TITLE} 1`,
      position: 0,
    },
  ];
}

export function normalizeLayers(layers: ProjectDraftDocument["layers"]) {
  return sortLayers(layers).map((layer, index) => ({
    ...layer,
    timing: normalizeTiming(layer.timing.start, layer.timing.end),
    content: {
      ...layer.content,
      layer: index,
    },
  }));
}

export function normalizeDraftDocument(draft: ProjectDraftDocument) {
  return parseProjectDraftDocument({
    ...serializeProjectDraftDocument(draft),
    canvas: {
      ...draft.canvas,
      frameRange: {
        start: Math.max(0, Math.round(draft.canvas.frameRange.start)),
        end: Math.max(
          Math.round(draft.canvas.frameRange.end),
          Math.round(draft.canvas.frameRange.start) + 1,
        ),
      },
      scrollHeightVh: Math.min(Math.max(draft.canvas.scrollHeightVh, 100), 600),
      scrubStrength: Math.min(Math.max(draft.canvas.scrubStrength, 0.05), 4),
      ...(draft.canvas.backgroundTrack
        ? {
            backgroundTrack: {
              ...draft.canvas.backgroundTrack,
              ...normalizeTiming(draft.canvas.backgroundTrack.start, draft.canvas.backgroundTrack.end),
            },
          }
        : {}),
    },
    bookmarks: normalizeBookmarks(draft.bookmarks),
    layers: normalizeLayers(draft.layers),
  });
}

export function buildInitialDraft(
  project: EditorContainerProps["project"],
  manifest: ProjectManifest,
) {
  return normalizeDraftDocument(
    project.draftJson
      ? parseProjectDraftDocument(project.draftJson)
      : buildProjectDraftDocument(project, manifest),
  );
}

export function getDefaultTextStyle(): OverlayStyle {
  return {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 34,
    lineHeight: 1.08,
    letterSpacing: 0,
    textAlign: "start",
    color: "#f6f7fb",
    opacity: 1,
    maxWidth: 420,
    italic: false,
    underline: false,
    textTransform: "none",
    buttonLike: false,
  };
}

export function createTextLayer(playhead: number, layerIndex: number): OverlayDefinition {
  return {
    id: createId("layer"),
    timing: normalizeTiming(playhead, playhead + DEFAULT_LAYER_SPAN),
    timingSource: "manual",
    content: {
      type: "text",
      text: "New story beat",
      align: "start",
      theme: "light",
      treatment: "default",
      layout: {
        x: 0.08,
        y: 0.18,
        width: 420,
      },
      style: getDefaultTextStyle(),
      background: {
        enabled: true,
        mode: "solid",
        color: "#0d1016",
        opacity: 0.82,
        radius: 14,
        paddingX: 18,
        paddingY: 14,
        borderColor: "#d6f6ff",
        borderOpacity: 0,
      },
      enterAnimation: {
        type: "fade",
        easing: "ease-out",
        duration: 0.45,
        delay: 0,
      },
      exitAnimation: {
        type: "none",
        easing: "ease-in-out",
        duration: 0.35,
      },
      playbackMode: "normal",
      blendMode: "normal",
      layer: layerIndex,
    },
  };
}

export function createMediaLayer(input: {
  asset: ProjectAssetWithVariants;
  assets: ProjectAssetWithVariants[];
  playhead: number;
  layerIndex: number;
}): OverlayDefinition {
  const metadata = getOverlayMediaMetadataFromAsset(input.asset);
  const resolvedUrl = input.asset.publicUrl;
  const previewUrl = getRenderableAssetPreview(input.asset, input.assets) || resolvedUrl;

  return {
    id: createId("layer"),
    timing: normalizeTiming(input.playhead, input.playhead + DEFAULT_LAYER_SPAN),
    timingSource: "manual",
    content: {
      type: "image",
      align: "center",
      theme: "light",
      treatment: "default",
      mediaUrl: resolvedUrl,
      mediaPreviewUrl: previewUrl,
      mediaAssetId: input.asset.id,
      mediaMetadata: metadata,
      playbackMode: metadata.kind === "video" ? "scroll-scrub" : "normal",
      blendMode: "normal",
      layout: {
        x: 0.5,
        y: 0.52,
        width: metadata.kind === "video" ? 720 : 520,
      },
      style: {
        ...getDefaultTextStyle(),
        opacity: 1,
        maxWidth: metadata.kind === "video" ? 720 : 520,
      },
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
      },
      enterAnimation: {
        type: "fade",
        easing: "ease-out",
        duration: 0.35,
        delay: 0,
      },
      exitAnimation: {
        type: "fade",
        easing: "ease-in-out",
        duration: 0.2,
      },
      layer: input.layerIndex,
    },
  };
}

export function isVideoLayer(layer?: OverlayDefinition) {
  const metadata = layer?.content.mediaMetadata;
  if (metadata?.kind === "video") {
    return true;
  }
  const url = layer?.content.mediaUrl ?? "";
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url);
}

export function getLayerLabel(layer: OverlayDefinition, index: number) {
  if (layer.content.type === "text") {
    const line = layer.content.text?.split("\n")[0]?.trim();
    return line?.length ? line : `Text ${index + 1}`;
  }
  if (isVideoLayer(layer)) {
    return `Video ${index + 1}`;
  }
  if (layer.content.mediaUrl) {
    return `Media ${index + 1}`;
  }
  return `Layer ${index + 1}`;
}

export function buildPreviewManifest(baseManifest: ProjectManifest, draft: ProjectDraftDocument): ProjectManifest {
  const baseCanvas = baseManifest.canvas;
  const baseSection = baseManifest.sections[0];
  const effectiveFrameCount = Math.max(
    baseCanvas.frameCount,
    baseSection?.frameCount ?? 0,
    draft.canvas.frameRange.end + 1,
    2,
  );
  const frameRange = normalizeFrameRange(draft.canvas.frameRange, effectiveFrameCount);

  const canvas = {
    ...baseCanvas,
    id: draft.canvas.id,
    presetId: draft.presetId,
    title: draft.title,
    progressMapping: {
      ...baseCanvas.progressMapping,
      frameCount: effectiveFrameCount,
      frameRange,
    },
    backgroundColor: draft.canvas.backgroundColor,
    backgroundTrack: draft.canvas.backgroundTrack,
    motion: {
      ...baseCanvas.motion,
      sectionHeightVh: draft.canvas.scrollHeightVh,
      scrubStrength: draft.canvas.scrubStrength,
    },
  };

  const compatibilitySection = {
    ...(baseSection ?? {
      id: draft.canvas.id,
      presetId: draft.presetId,
      title: draft.title,
      frameAssets: baseCanvas.frameAssets,
      frameCount: canvas.frameCount,
      progressMapping: canvas.progressMapping,
      overlays: [],
      moments: [],
      transitions: [],
      fallback: baseCanvas.fallback,
      motion: canvas.motion,
      presetConfig: baseCanvas.presetConfig,
      runtimeProfile: baseCanvas.runtimeProfile,
    }),
    id: draft.canvas.id,
    title: draft.title,
    presetId: draft.presetId,
    frameAssets: canvas.frameAssets,
    frameCount: canvas.frameCount,
    progressMapping: canvas.progressMapping,
    overlays: sortLayers(draft.layers),
    moments: [],
    transitions: [],
    backgroundColor: draft.canvas.backgroundColor,
    backgroundMedia: draft.canvas.backgroundTrack?.media,
    backgroundVideoEndBehavior: draft.canvas.backgroundTrack?.endBehavior,
    backgroundVideoRange: draft.canvas.backgroundTrack?.mediaRange,
    fallback: canvas.fallback,
    motion: canvas.motion,
    presetConfig: canvas.presetConfig,
    runtimeProfile: canvas.runtimeProfile,
  };

  return {
    ...baseManifest,
    project: {
      ...baseManifest.project,
      title: draft.title,
    },
    selectedPreset: draft.presetId,
    canvas,
    bookmarks: sortBookmarks(draft.bookmarks),
    layers: sortLayers(draft.layers),
    generatedAt: new Date().toISOString(),
    sections: [compatibilitySection],
  };
}

export function buildTimelineTracks(input: {
  draft: ProjectDraftDocument;
  orderedBookmarks: ProjectDraftDocument["bookmarks"];
  orderedLayers: ProjectDraftDocument["layers"];
  selectedBookmarkId: string;
}): TimelineTrackModel[] {
  const { draft, orderedBookmarks, orderedLayers, selectedBookmarkId } = input;

  const bookmarkTrack: TimelineTrackModel = {
    id: "track-bookmarks",
    label: "Bookmarks",
    type: "section",
    clips: orderedBookmarks.map((bookmark, index) => ({
      id: `bookmark-${bookmark.id}`,
      trackType: "section",
      label: bookmark.title,
      start: bookmark.position,
      end: orderedBookmarks[index + 1]?.position ?? 1,
      tint: "muted",
      metadata: {
        bookmarkId: bookmark.id,
        bookmarkIndex: index,
        isSelectedBookmark: bookmark.id === selectedBookmarkId,
        sectionHeightVh: draft.canvas.scrollHeightVh,
      },
    })),
    metadata: {
      bookmarkAddStart: 1,
      bookmarkAddEnd: 1,
    },
  };

  const layerTracks: TimelineTrackModel[] = orderedLayers.map((layer, index) => ({
    id: `track-layer-${layer.id}`,
    label: getLayerLabel(layer, index),
    type: "layer",
    clips: [
      {
        id: layer.id,
        trackType: "layer",
        label: getLayerLabel(layer, index),
        start: layer.timing.start,
        end: layer.timing.end,
        tint: "accent",
        metadata: {
          overlayId: layer.id,
          layerIndex: index,
          text: layer.content.text,
          contentType: isVideoLayer(layer) ? "video" : layer.content.type ?? "layer",
          enterAnimationType: layer.content.enterAnimation?.type ?? "fade",
          exitAnimationType: layer.content.exitAnimation?.type ?? "none",
          isGroup: layer.content.type === "group",
        },
      },
    ],
    metadata: {
      layerIndex: index,
    },
  }));

  return [bookmarkTrack, ...layerTracks];
}

export function buildTimelineSelection(
  selectedLayerId: string,
  selectedBookmarkId: string,
): TimelineSelection {
  if (selectedLayerId) {
    return { clipId: selectedLayerId, trackType: "layer" };
  }
  if (selectedBookmarkId) {
    return { clipId: `bookmark-${selectedBookmarkId}`, trackType: "section" };
  }
  return null;
}
