"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampProgress,
  frameIndexToSequenceProgress,
  normalizeTimingRange,
  type FontFamily,
  type OverlayDefinition,
  type ProjectDraftDocument,
  type OverlayTransition,
  type PresetId,
  type TransitionPreset,
} from "@motionroll/shared";
import { SidebarPanel, type SidebarContext } from "./editor-sidebar";
import { TopBar } from "./editor-top-bar";
import { PreviewStage } from "./preview-stage";
import { TimelinePanel } from "./timeline-panel";
import {
  deriveTimelineTracks,
  getFrameRangeFromClip,
  type TimelineClipModel,
  type TimelineSelection,
  type TimelineTrackModel,
} from "./timeline-model";
import type { EditorContainerProps } from "./editor-types";
import {
  getLocalProjectDraft,
  saveLocalProjectDraft,
  setLastOpenedProjectId,
  type LocalProjectDraftRecord,
} from "@/lib/local-project-db";
import { buildProjectDraftDocument } from "@/lib/project-draft";
import { getPrimarySourceAsset } from "@/lib/project-assets";

type HydratedOverlayDefinition = OverlayDefinition & {
  content: OverlayDefinition["content"] & {
    type: NonNullable<OverlayDefinition["content"]["type"]>;
    layout: NonNullable<OverlayDefinition["content"]["layout"]>;
    style: NonNullable<OverlayDefinition["content"]["style"]>;
    background: NonNullable<OverlayDefinition["content"]["background"]>;
    animation: NonNullable<OverlayDefinition["content"]["animation"]>;
    transition: NonNullable<OverlayDefinition["content"]["transition"]>;
  };
};

type EditorDraft = {
  title: string;
  presetId: PresetId;
  sceneName: string;
  sceneHeight: number;
  scrubStrength: number;
  frameRangeStart: number;
  frameRangeEnd: number;
  layerCount: number;
  overlays: HydratedOverlayDefinition[];
};

type HistoryState = {
  past: EditorDraft[];
  future: EditorDraft[];
};

const DESIGN_STAGE_WIDTH = 1440;
const DESIGN_STAGE_HEIGHT = 810;

type LayoutChangeOptions = {
  intent?: "move" | "resize";
  scaleX?: number;
  scaleY?: number;
  styleChanges?: Partial<NonNullable<OverlayDefinition["content"]["style"]>>;
  backgroundChanges?: Partial<NonNullable<OverlayDefinition["content"]["background"]>>;
};

function createDefaultOverlay(
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
        maxWidth:
          type === "image"
            ? 360
            : type === "group"
              ? 480
              : 420,
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

function normalizeTextHtml(input: unknown) {
  if (typeof input === "string") {
    return input;
  }

  if (input && typeof input === "object") {
    const legacy = input as {
      text?: string;
      eyebrow?: string;
      headline?: string;
      body?: string;
    };
    const parts = [legacy.text, legacy.eyebrow, legacy.headline, legacy.body]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    return parts.length > 0 ? parts.join("<br><br>") : undefined;
  }

  return undefined;
}

function hydrateOverlay(overlay: OverlayDefinition): HydratedOverlayDefinition {
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

function normalizeOverlayLayers<T extends { content: { layer?: number } }>(overlays: T[]) {
  return overlays.map((overlay, index) => {
    const sourceLayer = overlay.content.layer ?? Math.max(overlays.length - index - 1, 0);
    return {
      ...overlay,
      content: {
        ...overlay.content,
        layer: Math.max(0, sourceLayer),
      },
    };
  });
}

function isGroupOverlay(overlay: Pick<OverlayDefinition, "content">) {
  return overlay.content.type === "group";
}

function getRootOverlays<T extends { content: { layer?: number; parentGroupId?: string } }>(overlays: T[]) {
  return overlays.filter((overlay) => !overlay.content.parentGroupId);
}

function getTopLayerIndex<T extends { content: { layer?: number; parentGroupId?: string } }>(overlays: T[]) {
  return getRootOverlays(overlays).reduce(
    (maxLayer, overlay) => Math.max(maxLayer, overlay.content.layer ?? 0),
    -1,
  );
}

function getRequiredLayerCount<T extends { content: { layer?: number; parentGroupId?: string } }>(
  overlays: T[],
  requestedCount = 1,
) {
  return Math.max(1, requestedCount, getTopLayerIndex(overlays) + 1);
}

function reorderOverlayLayers<T extends { content: { layer?: number; parentGroupId?: string } }>(
  overlays: T[],
  layerCount: number,
  fromRow: number,
  toRow: number,
) {
  const distinctLayers = Array.from(
    { length: getRequiredLayerCount(overlays, layerCount) },
    (_, index) => index,
  ).sort((left, right) => right - left);
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
  if (typeof moved === "undefined") {
    return normalizeOverlayLayers(overlays);
  }
  nextRows.splice(toRow, 0, moved);

  const remappedLayers = new Map(nextRows.map((layer, index) => [layer, nextRows.length - index - 1]));
  return normalizeOverlayLayers(
    overlays.map((overlay) => ({
      ...overlay,
      content: {
        ...overlay.content,
        layer:
          overlay.content.parentGroupId
            ? overlay.content.layer ?? 0
            : remappedLayers.get(overlay.content.layer ?? 0) ?? 0,
      },
    })),
  );
}

function getOverlayById<T extends { id: string }>(overlays: T[], overlayId: string) {
  return overlays.find((overlay) => overlay.id === overlayId);
}

function getDirectGroupChildren<T extends { id: string; content: { parentGroupId?: string } }>(
  overlays: T[],
  groupId: string,
) {
  return overlays.filter((overlay) => overlay.content.parentGroupId === groupId);
}

function getRootOverlayId(
  overlays: Array<Pick<HydratedOverlayDefinition, "id" | "content">>,
  overlayId: string,
) {
  let current = getOverlayById(overlays, overlayId);
  while (current?.content.parentGroupId) {
    const parent = getOverlayById(overlays, current.content.parentGroupId);
    if (!parent) {
      break;
    }
    current = parent;
  }
  return current?.id ?? overlayId;
}

function estimateOverlayHeight(overlay: HydratedOverlayDefinition) {
  const explicitHeight = overlay.content.layout.height;
  if (typeof explicitHeight === "number") {
    return explicitHeight;
  }
  switch (overlay.content.type) {
    case "image":
      return 220;
    case "logo":
      return 80;
    case "icon":
      return 64;
    case "group":
      return 260;
    default:
      return 120;
  }
}

function getOverlayAbsoluteBounds(overlay: HydratedOverlayDefinition) {
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

function shiftOverlayAbsoluteLayout(
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

function getGroupSelectionEligibility(overlays: HydratedOverlayDefinition[], overlayIds: string[]) {
  if (overlayIds.length < 2) {
    return false;
  }
  return overlayIds.every((overlayId) => {
    const overlay = getOverlayById(overlays, overlayId);
    if (!overlay) {
      return false;
    }
    return !overlay.content.parentGroupId && !isGroupOverlay(overlay);
  });
}

function duplicateRootOverlays(
  overlays: HydratedOverlayDefinition[],
  rootOverlayIds: string[],
) {
  const duplicatesBySource = new Map<string, HydratedOverlayDefinition[]>();
  const duplicateIds: string[] = [];

  for (const rootOverlayId of rootOverlayIds) {
    const source = getOverlayById(overlays, rootOverlayId);
    if (!source) {
      continue;
    }

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

function deleteRootOverlays(
  overlays: HydratedOverlayDefinition[],
  rootOverlayIds: string[],
) {
  const removedIds = new Set(rootOverlayIds);
  return normalizeOverlayLayers(
    overlays.filter((overlay) => {
      if (removedIds.has(overlay.id)) {
        return false;
      }
      if (overlay.content.parentGroupId && removedIds.has(overlay.content.parentGroupId)) {
        return false;
      }
      return true;
    }),
  );
}

function createDraft(
  project: EditorContainerProps["project"],
  manifest: EditorContainerProps["manifest"],
): EditorDraft {
  const section = project.sections[0];
  const manifestSection = manifest.sections[0];

  return {
    title: project.title,
    presetId: project.selectedPreset,
    sceneName: section?.title ?? manifestSection?.title ?? "Scene 01",
    sceneHeight: section?.commonConfig.sectionHeightVh ?? manifestSection?.motion.sectionHeightVh ?? 240,
    scrubStrength: section?.commonConfig.scrubStrength ?? manifestSection?.motion.scrubStrength ?? 1,
    frameRangeStart: manifestSection?.progressMapping.frameRange.start ?? 0,
    frameRangeEnd: manifestSection?.progressMapping.frameRange.end ?? 180,
    layerCount: getRequiredLayerCount(manifestSection?.overlays ?? []),
    overlays: normalizeOverlayLayers((manifestSection?.overlays ?? []).map(hydrateOverlay)),
  };
}

function getDurationSeconds(project: EditorContainerProps["project"], frameCount: number) {
  const source = getPrimarySourceAsset(project.assets);
  const metadata = (source?.metadata ?? {}) as { durationMs?: number };
  return metadata.durationMs ? metadata.durationMs / 1000 : Math.max(frameCount / 24, 8);
}

function buildDraftManifest(
  manifest: EditorContainerProps["manifest"],
  draft: EditorDraft,
): EditorContainerProps["manifest"] {
  const section = manifest.sections[0];
  if (!section) {
    return manifest;
  }

  return {
    ...manifest,
    project: {
      ...manifest.project,
      title: draft.title,
    },
    selectedPreset: draft.presetId,
    sections: [
      {
        ...section,
        title: draft.sceneName,
        overlays: draft.overlays,
        progressMapping: {
          ...section.progressMapping,
          frameRange: {
            start: draft.frameRangeStart,
            end: draft.frameRangeEnd,
          },
        },
        motion: {
          ...section.motion,
          sectionHeightVh: draft.sceneHeight,
          scrubStrength: draft.scrubStrength,
        },
      },
    ],
  };
}

function createEditorDraftFromDocument(document: ProjectDraftDocument): EditorDraft {
  return {
    title: document.title,
    presetId: document.presetId,
    sceneName: document.sectionTitle,
    sceneHeight: document.sectionHeightVh,
    scrubStrength: document.scrubStrength,
    frameRangeStart: document.frameRangeStart,
    frameRangeEnd: document.frameRangeEnd,
    layerCount: getRequiredLayerCount(document.overlays, document.layerCount),
    overlays: normalizeOverlayLayers(document.overlays.map(hydrateOverlay)),
  };
}

function createDraftDocumentFromEditorDraft(draft: EditorDraft): ProjectDraftDocument {
  return {
    version: 1,
    title: draft.title,
    presetId: draft.presetId,
    sectionTitle: draft.sceneName,
    sectionHeightVh: draft.sceneHeight,
    scrubStrength: draft.scrubStrength,
    frameRangeStart: draft.frameRangeStart,
    frameRangeEnd: draft.frameRangeEnd,
    layerCount: getRequiredLayerCount(draft.overlays, draft.layerCount),
    overlays: draft.overlays.map(sanitizeOverlayForSave),
  };
}

function sanitizeOverlayForSave(overlay: HydratedOverlayDefinition): OverlayDefinition {
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

function findSelectedClip(tracks: TimelineTrackModel[], selection: TimelineSelection) {
  if (!selection) {
    return undefined;
  }

  return tracks.flatMap((track) => track.clips).find((clip) => clip.id === selection.clipId);
}

function findClipById(tracks: TimelineTrackModel[], clipId: string) {
  return tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);
}

function buildOverlayId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function clampPlayheadToSceneRange(
  playhead: number,
  frameRangeStart: number,
  frameRangeEnd: number,
  frameCount: number,
) {
  const safeFrameCount = Math.max(frameCount, 1);
  const rangeStart = frameIndexToSequenceProgress(frameRangeStart, safeFrameCount);
  const rangeEnd = frameIndexToSequenceProgress(frameRangeEnd, safeFrameCount);
  return clampProgress(Math.min(Math.max(playhead, rangeStart), rangeEnd));
}

export function ProjectEditor({ project, projects, manifest }: EditorContainerProps) {
  const initialRemoteDraft = buildProjectDraftDocument(project, manifest);
  const [projectState, setProjectState] = useState(project);
  const [manifestState, setManifestState] = useState(manifest);
  const [draft, setDraft] = useState(() => createEditorDraftFromDocument(initialRemoteDraft));
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [localSaveState, setLocalSaveState] = useState<"saving" | "saved" | "error">("saved");
  const [remoteSyncState, setRemoteSyncState] = useState<"idle" | "syncing" | "synced" | "error">("synced");
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0.24);
  const [selection, setSelection] = useState<TimelineSelection>(
    manifest.sections[0]?.overlays[0]
      ? { clipId: `layer-${manifest.sections[0].overlays[0].id}`, trackType: "layer" }
      : { clipId: "section-range", trackType: "section" },
  );
  const [selectedOverlayId, setSelectedOverlayId] = useState<string>(
    manifest.sections[0]?.overlays[0]?.id ?? "",
  );
  const [multiSelectedOverlayIds, setMultiSelectedOverlayIds] = useState<string[]>([]);
  const [activeSidebarContext, setActiveSidebarContext] = useState<SidebarContext>(
    manifest.sections[0]?.overlays[0] ? "edit" : "insert",
  );
  const playbackRafRef = useRef<number | null>(null);
  const playbackLastTickRef = useRef<number | null>(null);
  const playheadRef = useRef(playhead);
  const draftRef = useRef(draft);
  const hasUnsyncedChangesRef = useRef(hasUnsyncedChanges);
  const persistenceReadyRef = useRef(false);
  const syncTimeoutRef = useRef<number | null>(null);
  const syncPromiseRef = useRef<Promise<boolean> | null>(null);
  const pendingSyncAfterCurrentRef = useRef(false);
  const lastSyncedRevisionRef = useRef(project.draftRevision ?? 0);
  const latestLocalSaveAtRef = useRef(
    new Date(project.lastSavedAt ?? project.updatedAt ?? new Date()).toISOString(),
  );
  const localSaveIndicatorTimeoutRef = useRef<number | null>(null);

  const editorManifest = useMemo(() => buildDraftManifest(manifestState, draft), [draft, manifestState]);
  const frameCount = editorManifest.sections[0]?.frameCount ?? 0;
  const durationSeconds = useMemo(
    () => getDurationSeconds(projectState, frameCount),
    [frameCount, projectState],
  );
  const timelineTracks = useMemo(
    () => deriveTimelineTracks(editorManifest, durationSeconds, previewMode, draft.layerCount),
    [draft.layerCount, durationSeconds, editorManifest, previewMode],
  );
  const selectedClip = useMemo(
    () => findSelectedClip(timelineTracks, selection),
    [selection, timelineTracks],
  );
  const selectedOverlay = draft.overlays.find((overlay) => overlay.id === selectedOverlayId);
  const selectedRootOverlayId = selectedOverlayId
    ? getRootOverlayId(draft.overlays, selectedOverlayId)
    : "";
  const selectedTimelineClipIds = multiSelectedOverlayIds.map((overlayId) => `layer-${overlayId}`);
  const selectedRootOverlays = useMemo(
    () =>
      multiSelectedOverlayIds
        .map((overlayId) => getOverlayById(draft.overlays, overlayId))
        .filter((overlay): overlay is HydratedOverlayDefinition => Boolean(overlay)),
    [draft.overlays, multiSelectedOverlayIds],
  );
  const canGroupSelection = getGroupSelectionEligibility(draft.overlays, multiSelectedOverlayIds);
  const selectedGroupOverlay = useMemo(() => {
    if (!selectedOverlay) {
      return undefined;
    }
    if (isGroupOverlay(selectedOverlay)) {
      return selectedOverlay;
    }
    if (selectedOverlay.content.parentGroupId) {
      return getOverlayById(draft.overlays, selectedOverlay.content.parentGroupId);
    }
    return undefined;
  }, [draft.overlays, selectedOverlay]);
  const canUngroupSelection = Boolean(selectedGroupOverlay && isGroupOverlay(selectedGroupOverlay));
  const selectedGroupChildren = useMemo(() => {
    if (!selectedGroupOverlay || !isGroupOverlay(selectedGroupOverlay)) {
      return [];
    }
    return getDirectGroupChildren(draft.overlays, selectedGroupOverlay.id).map((child, index) => ({
      id: child.id,
      label:
        child.content.text?.split(/\r?\n/).find((line) => line.trim().length > 0) ??
        `${child.content.type ?? "item"} ${index + 1}`,
      type: child.content.type ?? "text",
    }));
  }, [draft.overlays, selectedGroupOverlay]);
  const hasUnpublishedChanges =
    hasUnsyncedChanges ||
    !projectState.lastPublishedAt ||
    new Date(projectState.updatedAt ?? 0).getTime() >
      new Date(projectState.lastPublishedAt).getTime();
  const saveStatus = {
    local: localSaveState,
    remote: remoteSyncState,
    hasUnsyncedChanges,
    hasUnpublishedChanges,
  } as const;
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    const nextPlayhead = clampPlayheadToSceneRange(
      playheadRef.current,
      draft.frameRangeStart,
      draft.frameRangeEnd,
      frameCount,
    );
    if (Math.abs(nextPlayhead - playheadRef.current) < 0.0005) {
      return;
    }

    setIsPlaying(false);
    playheadRef.current = nextPlayhead;
    setPlayhead(nextPlayhead);
  }, [draft.frameRangeEnd, draft.frameRangeStart, frameCount]);

  useEffect(() => {
    hasUnsyncedChangesRef.current = hasUnsyncedChanges;
  }, [hasUnsyncedChanges]);

  useEffect(() => {
    if (activeSidebarContext === "edit" && !selectedOverlay) {
      setActiveSidebarContext("insert");
    }
  }, [activeSidebarContext, selectedOverlay]);

  useEffect(() => {
    if (!selectedOverlayId) {
      return;
    }
    if (draft.overlays.some((overlay) => overlay.id === selectedOverlayId)) {
      return;
    }
    setSelectedOverlayId("");
  }, [draft.overlays, selectedOverlayId]);

  useEffect(() => {
    setMultiSelectedOverlayIds((current) =>
      current.filter((overlayId) =>
        draft.overlays.some(
          (overlay) => overlay.id === overlayId && !overlay.content.parentGroupId,
        ),
      ),
    );
  }, [draft.overlays]);

  useEffect(() => {
    if (!isPlaying) {
      if (playbackRafRef.current != null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      playbackLastTickRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (playbackLastTickRef.current == null) {
        playbackLastTickRef.current = timestamp;
      }
      const deltaMs = timestamp - playbackLastTickRef.current;
      playbackLastTickRef.current = timestamp;
      const progressDelta = deltaMs / Math.max(durationSeconds * 1000, 1);
      const nextPlayhead = clampProgress(playheadRef.current + progressDelta);
      playheadRef.current = nextPlayhead;
      setPlayhead(nextPlayhead);

      if (nextPlayhead >= 1) {
        playbackRafRef.current = null;
        playbackLastTickRef.current = null;
        setIsPlaying(false);
        return;
      }

      playbackRafRef.current = window.requestAnimationFrame(step);
    };

    playbackRafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (playbackRafRef.current != null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      playbackLastTickRef.current = null;
    };
  }, [durationSeconds, isPlaying]);

  function clearScheduledSync() {
    if (syncTimeoutRef.current != null) {
      window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }

  function replaceDraftState(
    nextDraft: EditorDraft,
    options: {
      clearHistory?: boolean;
      hasUnsyncedChanges?: boolean;
      remoteState?: "idle" | "syncing" | "synced" | "error";
    } = {},
  ) {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    if (options.clearHistory) {
      setHistory({ past: [], future: [] });
    }
    if (typeof options.hasUnsyncedChanges === "boolean") {
      setHasUnsyncedChanges(options.hasUnsyncedChanges);
    }
    if (options.remoteState) {
      setRemoteSyncState(options.remoteState);
    }
  }

  async function writeDraftLocally(
    nextDraft: EditorDraft,
    options: {
      dirty: boolean;
      lastSyncedRevision?: number;
      lastSyncedAt?: string;
    },
  ) {
    const now = new Date().toISOString();
    latestLocalSaveAtRef.current = now;
    if (localSaveIndicatorTimeoutRef.current != null) {
      window.clearTimeout(localSaveIndicatorTimeoutRef.current);
    }
    localSaveIndicatorTimeoutRef.current = window.setTimeout(() => {
      setLocalSaveState("saving");
    }, 120);

    const record: LocalProjectDraftRecord = {
      projectId: projectState.id,
      draft: createDraftDocumentFromEditorDraft(nextDraft),
      remoteRevision: options.lastSyncedRevision ?? lastSyncedRevisionRef.current,
      lastSyncedRevision: options.lastSyncedRevision ?? lastSyncedRevisionRef.current,
      dirty: options.dirty,
      lastLocalSaveAt: now,
      lastSyncedAt: options.lastSyncedAt,
      pendingSyncAt: options.dirty ? now : undefined,
    };

    try {
      await saveLocalProjectDraft(record);
      if (localSaveIndicatorTimeoutRef.current != null) {
        window.clearTimeout(localSaveIndicatorTimeoutRef.current);
        localSaveIndicatorTimeoutRef.current = null;
      }
      setLocalSaveState("saved");
    } catch {
      if (localSaveIndicatorTimeoutRef.current != null) {
        window.clearTimeout(localSaveIndicatorTimeoutRef.current);
        localSaveIndicatorTimeoutRef.current = null;
      }
      setLocalSaveState("error");
    }
  }

  function scheduleRemoteSync(delay = 900) {
    // Editor writes go to IndexedDB immediately; network sync is intentionally coalesced.
    if (!persistenceReadyRef.current || !hasUnsyncedChanges) {
      return;
    }

    clearScheduledSync();
    syncTimeoutRef.current = window.setTimeout(() => {
      void flushRemoteSync();
    }, delay);
  }

  function sendBackgroundDraftSync() {
    if (
      !persistenceReadyRef.current ||
      !hasUnsyncedChangesRef.current ||
      syncPromiseRef.current ||
      typeof window === "undefined"
    ) {
      return false;
    }

    const payload = createDraftDocumentFromEditorDraft(draftRef.current);
    const body = JSON.stringify({
      draft: payload,
      baseRevision: lastSyncedRevisionRef.current,
    });
    const endpoint = `/api/projects/${projectState.id}/draft`;

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const queued = navigator.sendBeacon(
          endpoint,
          new Blob([body], { type: "application/json" }),
        );
        if (queued) {
          return true;
        }
      } catch {
        // Fall back to fetch keepalive below.
      }
    }

    void fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      keepalive: true,
    }).catch(() => undefined);

    return true;
  }

  async function flushRemoteSync() {
    if (!persistenceReadyRef.current || !hasUnsyncedChangesRef.current) {
      return true;
    }

    clearScheduledSync();

    if (syncPromiseRef.current) {
      pendingSyncAfterCurrentRef.current = true;
      return syncPromiseRef.current;
    }

    const payload = createDraftDocumentFromEditorDraft(draftRef.current);
    const payloadSignature = JSON.stringify(payload);
    const baseRevision = lastSyncedRevisionRef.current;
    setRemoteSyncState("syncing");

    const syncPromise = fetch(`/api/projects/${projectState.id}/draft`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        draft: payload,
        baseRevision,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          ok: boolean;
          conflict?: boolean;
          draft: ProjectDraftDocument;
          manifest: typeof manifestState;
          project: typeof projectState | null;
          revision: number;
          updatedAt: string;
        };

        if (response.status === 409 && data.conflict) {
          const localIsNewer =
            latestLocalSaveAtRef.current >= data.updatedAt || hasUnsyncedChangesRef.current;
          console.warn(
            `[MotionRoll] Draft revision mismatch for ${projectState.id}. ` +
              `localRevision=${baseRevision} remoteRevision=${data.revision}`,
          );

          lastSyncedRevisionRef.current = data.revision;
          if (localIsNewer) {
            setRemoteSyncState("idle");
            scheduleRemoteSync(150);
            return false;
          }

          const nextDraft = createEditorDraftFromDocument(data.draft);
            replaceDraftState(nextDraft, {
              clearHistory: false,
              hasUnsyncedChanges: false,
              remoteState: "synced",
            });
            if (data.project) {
              setProjectState(data.project);
            }
            await writeDraftLocally(nextDraft, {
              dirty: false,
              lastSyncedRevision: data.revision,
              lastSyncedAt: data.updatedAt,
          });
          return false;
        }

        if (!response.ok) {
          setRemoteSyncState("error");
          return false;
        }

          lastSyncedRevisionRef.current = data.revision;
          if (data.project) {
            setProjectState(data.project);
          }

          const currentDraftDocument = createDraftDocumentFromEditorDraft(draftRef.current);
          const stillMatchesSyncedPayload =
            JSON.stringify(currentDraftDocument) === payloadSignature;
        setHasUnsyncedChanges(!stillMatchesSyncedPayload);
        setRemoteSyncState(stillMatchesSyncedPayload ? "synced" : "idle");

        await writeDraftLocally(
          stillMatchesSyncedPayload
            ? createEditorDraftFromDocument(payload)
            : draftRef.current,
          {
            dirty: !stillMatchesSyncedPayload,
            lastSyncedRevision: data.revision,
            lastSyncedAt: data.updatedAt,
          },
        );

        if (!stillMatchesSyncedPayload) {
          scheduleRemoteSync(250);
        }

        return true;
      })
      .catch(() => {
        setRemoteSyncState("error");
        return false;
      })
      .finally(() => {
        syncPromiseRef.current = null;
        if (pendingSyncAfterCurrentRef.current) {
          pendingSyncAfterCurrentRef.current = false;
          scheduleRemoteSync(200);
        }
      });

    syncPromiseRef.current = syncPromise;
    return syncPromise;
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrateProjectState() {
      await setLastOpenedProjectId(projectState.id);
      const remoteUpdatedAt = new Date(
        projectState.lastSavedAt ?? projectState.updatedAt ?? new Date(),
      ).toISOString();
      const localRecord = await getLocalProjectDraft(projectState.id);
      if (cancelled) {
        return;
      }

      if (
        localRecord &&
        (localRecord.dirty ||
          localRecord.lastSyncedRevision > lastSyncedRevisionRef.current ||
          localRecord.lastLocalSaveAt >= remoteUpdatedAt)
      ) {
        replaceDraftState(createEditorDraftFromDocument(localRecord.draft), {
          clearHistory: true,
          hasUnsyncedChanges: localRecord.dirty,
          remoteState: localRecord.dirty ? "idle" : "synced",
        });
        lastSyncedRevisionRef.current = localRecord.lastSyncedRevision;
        latestLocalSaveAtRef.current = localRecord.lastLocalSaveAt;
      } else {
        await writeDraftLocally(draftRef.current, {
          dirty: false,
          lastSyncedRevision: lastSyncedRevisionRef.current,
          lastSyncedAt: remoteUpdatedAt,
        });
      }

      persistenceReadyRef.current = true;

      try {
        const response = await fetch(`/api/projects/${projectState.id}/draft`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          draft: ProjectDraftDocument;
          manifest: typeof manifestState;
          project: typeof projectState | null;
          revision: number;
          updatedAt: string;
        };

        if (cancelled) {
          return;
        }

        const localAfterFetch = await getLocalProjectDraft(projectState.id);
        if (cancelled) {
          return;
        }

          lastSyncedRevisionRef.current = data.revision;
          if (
            localAfterFetch &&
            (localAfterFetch.dirty || localAfterFetch.lastLocalSaveAt > data.updatedAt)
          ) {
            console.warn(
            `[MotionRoll] Keeping newer local draft for ${projectState.id} while remote cache refresh completed.`,
            );
            return;
          }

          if (data.project) {
            setProjectState(data.project);
          }
          setManifestState(data.manifest);
          replaceDraftState(createEditorDraftFromDocument(data.draft), {
            clearHistory: true,
            hasUnsyncedChanges: false,
            remoteState: "synced",
        });
        await writeDraftLocally(createEditorDraftFromDocument(data.draft), {
          dirty: false,
          lastSyncedRevision: data.revision,
          lastSyncedAt: data.updatedAt,
        });
      } catch {
        setRemoteSyncState((current) => (current === "syncing" ? "error" : current));
      }
    }

    void hydrateProjectState();

      return () => {
        cancelled = true;
        persistenceReadyRef.current = false;
        clearScheduledSync();
        if (localSaveIndicatorTimeoutRef.current != null) {
          window.clearTimeout(localSaveIndicatorTimeoutRef.current);
          localSaveIndicatorTimeoutRef.current = null;
        }
      };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectState.id]);

  useEffect(() => {
    if (!persistenceReadyRef.current) {
      return;
    }

    void writeDraftLocally(draft, {
      dirty: hasUnsyncedChanges,
    });

    if (hasUnsyncedChanges) {
      scheduleRemoteSync();
    }
  }, [draft, hasUnsyncedChanges]);

  useEffect(() => {
    if (!persistenceReadyRef.current) {
      return;
    }

    const flush = () => {
      if (hasUnsyncedChanges) {
        void flushRemoteSync();
      }
    };
    const queueBackgroundSync = () => {
      if (hasUnsyncedChangesRef.current) {
        sendBackgroundDraftSync();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    window.addEventListener("blur", flush);
    window.addEventListener("pagehide", queueBackgroundSync);
    window.addEventListener("beforeunload", queueBackgroundSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", flush);
      window.removeEventListener("pagehide", queueBackgroundSync);
      window.removeEventListener("beforeunload", queueBackgroundSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasUnsyncedChanges]);

  // Global keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      // Don't intercept while typing in an input or contenteditable
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement).contentEditable === "true";
      if (isEditable) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "s") {
        e.preventDefault();
        void flushRemoteSync();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePreview() {
    const previewUrl = `/projects/${projectState.id}/preview`;
    if (!hasUnsyncedChangesRef.current) {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const previewWindow = window.open("", "_blank", "noopener,noreferrer");
    const didFlush = await flushRemoteSync();
    if (!didFlush) {
      previewWindow?.close();
      window.alert("MotionRoll could not sync the latest draft for preview yet. Please try again.");
      return;
    }

    if (previewWindow) {
      previewWindow.location.href = previewUrl;
      return;
    }

    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  async function handlePublish() {
    const didFlush = await flushRemoteSync();
    if (!didFlush) {
      window.alert("MotionRoll could not sync the latest draft for publish yet. Please try again.");
      return;
    }

    window.location.href = `/projects/${projectState.id}/publish`;
  }

  function pushHistory(current: EditorDraft) {
    setHistory((historyState) => ({
      past: [...historyState.past.slice(-39), structuredClone(current)],
      future: [],
    }));
  }

  function applyDraft(nextDraft: EditorDraft, recordHistory = true) {
    const current = draftRef.current;
    // Quick shallow diff — overlays array reference change is the main signal
    if (current === nextDraft) {
      return;
    }

    if (recordHistory) {
      pushHistory(current);
    }

    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setHasUnsyncedChanges(true);
    setRemoteSyncState("idle");
  }

  function updateDraft(
    transform: (current: EditorDraft) => EditorDraft,
    recordHistory = true,
  ) {
    applyDraft(transform(structuredClone(draftRef.current)), recordHistory);
  }

  function handleUndo() {
    setHistory((historyState) => {
      const previous = historyState.past.at(-1);
      if (!previous) {
        return historyState;
      }

      const current = structuredClone(draftRef.current);
      draftRef.current = structuredClone(previous);
      setDraft(structuredClone(previous));
      setHasUnsyncedChanges(true);
      setRemoteSyncState("idle");
      return {
        past: historyState.past.slice(0, -1),
        future: [current, ...historyState.future].slice(0, 40),
      };
    });
  }

  function handleRedo() {
    setHistory((historyState) => {
      const [next, ...future] = historyState.future;
      if (!next) {
        return historyState;
      }

      const current = structuredClone(draftRef.current);
      draftRef.current = structuredClone(next);
      setDraft(structuredClone(next));
      setHasUnsyncedChanges(true);
      setRemoteSyncState("idle");
      return {
        past: [...historyState.past, current].slice(-40),
        future,
      };
    });
  }

  function handleSelectionChange(
    nextSelection: TimelineSelection,
    options?: { additive?: boolean },
  ) {
    const nextOverlayId =
      nextSelection?.trackType === "layer"
        ? findClipById(timelineTracks, nextSelection.clipId)?.metadata?.overlayId
        : undefined;

    if (nextOverlayId) {
      const nextSelectedIds = options?.additive
        ? multiSelectedOverlayIds.includes(nextOverlayId)
          ? multiSelectedOverlayIds.filter((overlayId) => overlayId !== nextOverlayId)
          : [...multiSelectedOverlayIds, nextOverlayId]
        : [nextOverlayId];
      const activeOverlayId = nextSelectedIds.at(-1) ?? "";

      setSelection(
        activeOverlayId
          ? { clipId: `layer-${activeOverlayId}`, trackType: "layer" }
          : { clipId: "section-range", trackType: "section" },
      );
      setSelectedOverlayId(activeOverlayId);
      setActiveSidebarContext(activeOverlayId ? "edit" : "insert");
      setMultiSelectedOverlayIds(nextSelectedIds);
      return;
    }

    setSelection(nextSelection);
    setMultiSelectedOverlayIds([]);
    setSelectedOverlayId("");
    setActiveSidebarContext((current) => (current === "edit" ? "insert" : current));
  }

  function handleClipTimingChange(clipId: string, timing: { start: number; end: number }) {
    const clip = findClipById(timelineTracks, clipId);
    if (!clip) {
      return;
    }

    updateDraft((current) => {
      if (clip.trackType === "section") {
        const nextFrameRange = getFrameRangeFromClip(timing, frameCount);
        return {
          ...current,
          frameRangeStart: nextFrameRange.start,
          frameRangeEnd: nextFrameRange.end,
        };
      }

      const overlayId = clip.metadata?.overlayId;
      if (!overlayId) {
        return current;
      }

      return {
        ...current,
        overlays: current.overlays.map((overlay) =>
          overlay.id === overlayId ? { ...overlay, timing } : overlay,
        ),
      };
    });
  }

  function selectOverlay(overlayId: string, options?: { additive?: boolean }) {
    if (!overlayId) {
      setSelection({ clipId: "section-range", trackType: "section" });
      setSelectedOverlayId("");
      setMultiSelectedOverlayIds([]);
      setActiveSidebarContext((current) => (current === "edit" ? "insert" : current));
      return;
    }

    const rootOverlayId = getRootOverlayId(draftRef.current.overlays, overlayId);
    const rootOverlay = getOverlayById(draftRef.current.overlays, rootOverlayId);
    const nextSelectedOverlayId =
      rootOverlay && isGroupOverlay(rootOverlay)
        ? rootOverlayId
        : overlayId;
    const nextSelectedIds = options?.additive
      ? multiSelectedOverlayIds.includes(rootOverlayId)
        ? multiSelectedOverlayIds.filter((id) => id !== rootOverlayId)
        : [...multiSelectedOverlayIds, rootOverlayId]
      : [rootOverlayId];
    const activeRootOverlayId = nextSelectedIds.at(-1) ?? "";
    const nextSelection = activeRootOverlayId
      ? { clipId: `layer-${activeRootOverlayId}`, trackType: "layer" as const }
      : { clipId: "section-range", trackType: "section" as const };

    setSelection((current) =>
      current?.clipId === nextSelection.clipId && current.trackType === nextSelection.trackType
        ? current
        : nextSelection,
    );
    setSelectedOverlayId(options?.additive ? activeRootOverlayId : nextSelectedOverlayId);
    setMultiSelectedOverlayIds(nextSelectedIds);
    setActiveSidebarContext(activeRootOverlayId ? "edit" : "insert");
  }

  function addOverlay(type: string) {
    if (type === "video") {
      setSelection({ clipId: "section-range", trackType: "section" });
      setActiveSidebarContext("upload");
      return;
    }

    const normalizedType = type === "section" ? "moment" : type;

    const contentType =
      normalizedType === "image" || normalizedType === "logo" || normalizedType === "icon"
        ? normalizedType
        : "text";
    const overlayId = buildOverlayId(normalizedType);
    const overlay = createDefaultOverlay(
      overlayId,
      contentType,
      playheadRef.current,
      undefined,
    );
    if (normalizedType === "moment") {
      overlay.content.text = "Moment\n\nNew section beat";
      overlay.content.transition = {
        preset: "wipe",
        easing: "ease-in-out",
        duration: 0.42,
      } satisfies OverlayTransition;
    }

    updateDraft((current) => ({
      ...current,
      layerCount: getRequiredLayerCount(current.overlays, current.layerCount),
      overlays: normalizeOverlayLayers([
        {
          ...overlay,
          content: {
            ...overlay.content,
            layer: Math.max(getRequiredLayerCount(current.overlays, current.layerCount) - 1, 0),
          },
        },
        ...current.overlays,
      ]),
    }));
    selectOverlay(overlayId);
  }

  function handleGroupSelection() {
    updateDraft((current) => {
      if (!getGroupSelectionEligibility(current.overlays, multiSelectedOverlayIds)) {
        return current;
      }

      const selected = multiSelectedOverlayIds
        .map((overlayId) => getOverlayById(current.overlays, overlayId))
        .filter((overlay): overlay is HydratedOverlayDefinition => Boolean(overlay));
      if (selected.length < 2) {
        return current;
      }

      const bounds = selected
        .map(getOverlayAbsoluteBounds)
        .reduce(
          (acc, next) => ({
            left: Math.min(acc.left, next.left),
            top: Math.min(acc.top, next.top),
            right: Math.max(acc.right, next.right),
            bottom: Math.max(acc.bottom, next.bottom),
          }),
          {
            left: Number.POSITIVE_INFINITY,
            top: Number.POSITIVE_INFINITY,
            right: Number.NEGATIVE_INFINITY,
            bottom: Number.NEGATIVE_INFINITY,
          },
        );

      const groupId = buildOverlayId("group");
      const group = createDefaultOverlay(groupId, "group", playheadRef.current);
      group.timing = normalizeTimingRange(
        {
          start: Math.min(...selected.map((overlay) => overlay.timing.start)),
          end: Math.max(...selected.map((overlay) => overlay.timing.end)),
        },
        0.08,
      );
      group.content.layer = Math.max(...selected.map((overlay) => overlay.content.layer ?? 0));
      group.content.layout = {
        x: clampProgress(bounds.left),
        y: clampProgress(bounds.top),
        width: Math.max(140, Math.round((bounds.right - bounds.left) * DESIGN_STAGE_WIDTH)),
        height: Math.max(80, Math.round((bounds.bottom - bounds.top) * DESIGN_STAGE_HEIGHT)),
      };
      group.content.style.maxWidth = group.content.layout.width;
      group.content.background.paddingX = 0;
      group.content.background.paddingY = 0;

      const nextOverlays = normalizeOverlayLayers([
        group,
        ...current.overlays.map((overlay) =>
          multiSelectedOverlayIds.includes(overlay.id)
            ? {
                ...overlay,
                content: {
                  ...overlay.content,
                  parentGroupId: groupId,
                },
              }
            : overlay,
        ),
      ]);

      queueMicrotask(() => {
        setMultiSelectedOverlayIds([groupId]);
        selectOverlay(groupId);
      });

      return {
        ...current,
        layerCount: getRequiredLayerCount(nextOverlays, current.layerCount),
        overlays: nextOverlays,
      };
    });
  }

  function handleUngroupOverlay(overlayId: string) {
    updateDraft((current) => {
      const overlay = getOverlayById(current.overlays, overlayId);
      if (!overlay || !isGroupOverlay(overlay)) {
        return current;
      }

      const nextOverlays = normalizeOverlayLayers(
        current.overlays
          .filter((item) => item.id !== overlayId)
          .map((item) =>
            item.content.parentGroupId === overlayId
              ? {
                  ...item,
                  content: {
                    ...item.content,
                    parentGroupId: undefined,
                  },
                }
              : item,
          ),
      );

      queueMicrotask(() => {
        const childToSelect = getDirectGroupChildren(current.overlays, overlayId)[0]?.id ?? "";
        if (childToSelect) {
          selectOverlay(childToSelect);
        } else {
          setSelectedOverlayId("");
          setMultiSelectedOverlayIds([]);
          setSelection({ clipId: "section-range", trackType: "section" });
        }
      });

      return {
        ...current,
        layerCount: getRequiredLayerCount(nextOverlays, current.layerCount),
        overlays: nextOverlays,
      };
    });
  }

  function handleDuplicateClip(clipId: string) {
    const clip = findClipById(timelineTracks, clipId);
    const overlayId = clip?.metadata?.overlayId;
    if (!overlayId) {
      return;
    }

    let nextDuplicateId = "";
    updateDraft((current) => {
      const { overlays, duplicateIds } = duplicateRootOverlays(current.overlays, [overlayId]);
      const duplicateId = duplicateIds[0];
      if (!duplicateId) {
        return current;
      }
      nextDuplicateId = duplicateId;

      return {
        ...current,
        overlays,
      };
    });
    if (nextDuplicateId) {
      selectOverlay(nextDuplicateId);
    }
  }

  function handleDeleteClip(clipId: string) {
    const clip = findClipById(timelineTracks, clipId);
    const overlayId = clip?.metadata?.overlayId;
    if (!overlayId) {
      return;
    }

    updateDraft((current) => {
      const nextOverlays = deleteRootOverlays(current.overlays, [overlayId]);

      return {
        ...current,
        layerCount: getRequiredLayerCount(nextOverlays, current.layerCount),
        overlays: normalizeOverlayLayers(nextOverlays),
      };
    });
    setSelectedOverlayId("");
    setMultiSelectedOverlayIds([]);
    setSelection({ clipId: "section-range", trackType: "section" });
  }

  function updateSelectedOverlay(
    transform: (overlay: HydratedOverlayDefinition) => HydratedOverlayDefinition,
  ) {
    if (!selectedOverlay) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      overlays: current.overlays.map((overlay) =>
        overlay.id === selectedOverlay.id ? transform(overlay) : overlay,
      ),
    }));
  }


  function handleDuplicateOverlay(overlayId: string) {
    const rootOverlayId = getRootOverlayId(draftRef.current.overlays, overlayId);
    handleDuplicateClip(`layer-${rootOverlayId}`);
  }

  function handleDeleteOverlay(overlayId: string) {
    const rootOverlayId = getRootOverlayId(draftRef.current.overlays, overlayId);
    handleDeleteClip(`layer-${rootOverlayId}`);
  }

  function handleMoveSelection(delta: { x: number; y: number }) {
    if (multiSelectedOverlayIds.length < 2) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      overlays: current.overlays.map((overlay) => {
        const isSelectedRoot = multiSelectedOverlayIds.includes(overlay.id);
        const isSelectedGroupChild =
          overlay.content.parentGroupId !== undefined &&
          multiSelectedOverlayIds.includes(overlay.content.parentGroupId);

        if (!isSelectedRoot && !isSelectedGroupChild) {
          return overlay;
        }

        return shiftOverlayAbsoluteLayout(hydrateOverlay(overlay), delta.x, delta.y);
      }),
    }));
  }

  function handleDuplicateSelection() {
    if (multiSelectedOverlayIds.length < 2) {
      if (selectedOverlayId) {
        handleDuplicateOverlay(selectedOverlayId);
      }
      return;
    }

    let duplicateIds: string[] = [];
    updateDraft((current) => {
      const result = duplicateRootOverlays(current.overlays, multiSelectedOverlayIds);
      duplicateIds = result.duplicateIds;
      return {
        ...current,
        overlays: result.overlays,
      };
    });

    if (duplicateIds.length > 0) {
      const activeDuplicateId = duplicateIds[duplicateIds.length - 1];
      if (!activeDuplicateId) {
        return;
      }
      setSelection({ clipId: `layer-${activeDuplicateId}`, trackType: "layer" });
      setSelectedOverlayId(activeDuplicateId);
      setMultiSelectedOverlayIds(duplicateIds);
      setActiveSidebarContext("edit");
    }
  }

  function handleDeleteSelection() {
    if (multiSelectedOverlayIds.length < 2) {
      if (selectedOverlayId) {
        handleDeleteOverlay(selectedOverlayId);
      }
      return;
    }

    updateDraft((current) => ({
      ...current,
      ...(() => {
        const overlays = deleteRootOverlays(current.overlays, multiSelectedOverlayIds);
        return {
          layerCount: getRequiredLayerCount(overlays, current.layerCount),
          overlays,
        };
      })(),
    }));
    setSelectedOverlayId("");
    setMultiSelectedOverlayIds([]);
    setSelection({ clipId: "section-range", trackType: "section" });
    setActiveSidebarContext((current) => (current === "edit" ? "insert" : current));
  }

  function handleOverlayStyleQuickChange(overlayId: string, changes: Record<string, unknown>) {
    setDraft((current) => {
      let didChange = false;
      const overlays = current.overlays.map((overlay) => {
        if (overlay.id !== overlayId) {
          return overlay;
        }

        didChange = true;
        return {
          ...overlay,
          content: {
            ...overlay.content,
            style: {
              ...overlay.content.style,
              ...(changes.fontFamily !== undefined ? { fontFamily: String(changes.fontFamily) as FontFamily } : {}),
              ...(changes.fontWeight !== undefined ? { fontWeight: Number(changes.fontWeight) } : {}),
              ...(changes.fontSize !== undefined ? { fontSize: Number(changes.fontSize) } : {}),
              ...(changes.color !== undefined ? { color: String(changes.color) } : {}),
              ...(changes.italic !== undefined ? { italic: Boolean(changes.italic) } : {}),
              ...(changes.underline !== undefined ? { underline: Boolean(changes.underline) } : {}),
              ...(changes.textAlign !== undefined ? { textAlign: changes.textAlign as "start" | "center" | "end" } : {}),
            },
            background: {
              ...overlay.content.background,
              ...(changes.backgroundColor !== undefined ? { color: String(changes.backgroundColor) } : {}),
              ...(changes.backgroundBorderColor !== undefined ? { borderColor: String(changes.backgroundBorderColor) } : {}),
            },
          },
        };
      });

      if (!didChange) {
        return current;
      }

      const nextDraft = { ...current, overlays };
      draftRef.current = nextDraft;
      setHasUnsyncedChanges(true);
      setRemoteSyncState("idle");
      return nextDraft;
    });
  }

  function handleSetClipTransitionPreset(clipId: string, preset?: string) {
    const clip = findClipById(timelineTracks, clipId);
    const overlayId = clip?.metadata?.overlayId;
    if (!overlayId) return;

    updateDraft((current) => ({
      ...current,
      overlays: current.overlays.map((overlay) =>
        overlay.id === overlayId
          ? {
              ...overlay,
              content: {
                ...overlay.content,
                transition: {
                  ...(overlay.content.transition ?? { preset: "fade", easing: "ease-in-out", duration: 0.4 }),
                  preset: (preset ?? "fade") as TransitionPreset,
                },
              },
            }
          : overlay,
      ),
    }));
  }

  function handleCommitClipMove(move: { clipId: string; start: number; end: number; targetLayer?: number }) {
    const clip = findClipById(timelineTracks, move.clipId);
    const overlayId = clip?.metadata?.overlayId;
    if (!overlayId) {
      return;
    }

    updateDraft((current) => {
      const overlay = getOverlayById(current.overlays, overlayId);
      if (!overlay) {
        return current;
      }

      const nextOverlays = current.overlays.map((item) => {
        if (item.id === overlayId) {
          return {
            ...item,
            timing: {
              start: move.start,
              end: move.end,
            },
            content: {
              ...item.content,
              layer: move.targetLayer ?? item.content.layer ?? 0,
            },
          };
        }

        if (isGroupOverlay(overlay) && item.content.parentGroupId === overlayId) {
          return {
            ...item,
            content: {
              ...item.content,
              layer: move.targetLayer ?? overlay.content.layer ?? item.content.layer ?? 0,
            },
          };
        }

        return item;
      });

      return {
        ...current,
        layerCount: getRequiredLayerCount(nextOverlays, current.layerCount),
        overlays: normalizeOverlayLayers(nextOverlays),
      };
    });
  }

  function handleMoveClipToLayer(clipId: string, targetLayer: number) {
    const clip = findClipById(timelineTracks, clipId);
    if (!clip) {
      return;
    }

    handleCommitClipMove({
      clipId,
      start: clip.start,
      end: clip.end,
      targetLayer,
    });
  }

  function handleMoveClipToNewLayer(clipId: string) {
    const clip = findClipById(timelineTracks, clipId);
    const overlayId = clip?.metadata?.overlayId;
    if (!overlayId) {
      return;
    }

    updateDraft((current) => {
      const targetLayer = current.layerCount;
      return {
        ...current,
        layerCount: targetLayer + 1,
        overlays: normalizeOverlayLayers(
          current.overlays.map((overlay) =>
            overlay.id === overlayId ||
            overlay.content.parentGroupId === overlayId
              ? {
                  ...overlay,
                  content: {
                    ...overlay.content,
                    layer: targetLayer,
                  },
                }
              : overlay,
          ),
        ),
      };
    });
  }

  function handleReorderOverlays(fromIndex: number, toIndex: number) {
    updateDraft((current) => {
      return {
        ...current,
        overlays: reorderOverlayLayers(current.overlays, current.layerCount, fromIndex, toIndex),
      };
    });
  }

  function handleAddLayer() {
    updateDraft((current) => ({
      ...current,
      layerCount: current.layerCount + 1,
    }));
  }

  function handleDeleteLayer(layerRowIndex: number) {
    updateDraft((current) => {
      if (current.layerCount <= 1 || layerRowIndex < 0 || layerRowIndex >= current.layerCount) {
        return current;
      }

      const layerValue = current.layerCount - layerRowIndex - 1;
      const deletedRootIds = new Set(
        getRootOverlays(current.overlays)
          .filter((overlay) => (overlay.content.layer ?? 0) === layerValue)
          .map((overlay) => overlay.id),
      );

      const nextOverlays = current.overlays.flatMap((overlay) => {
        if (deletedRootIds.has(overlay.id) || (overlay.content.parentGroupId && deletedRootIds.has(overlay.content.parentGroupId))) {
          return [];
        }

        const overlayLayer = overlay.content.layer ?? 0;
        if (!overlay.content.parentGroupId && overlayLayer > layerValue) {
          return [{
            ...overlay,
            content: {
              ...overlay.content,
              layer: overlayLayer - 1,
            },
          }];
        }

        return [overlay];
      });

      return {
        ...current,
        layerCount: getRequiredLayerCount(nextOverlays, current.layerCount - 1),
        overlays: normalizeOverlayLayers(nextOverlays),
      };
    });
  }

  return (
    <main
      className="flex h-screen min-h-screen flex-col overflow-hidden"
      style={{ background: "var(--editor-shell)", color: "var(--editor-text)" }}
    >
      <TopBar
        projectId={projectState.id}
        projectName={draft.title}
        projects={projects}
        sectionTitle={draft.sceneName}
        frameRangeStart={draft.frameRangeStart}
        frameRangeEnd={draft.frameRangeEnd}
        scrubStrength={draft.scrubStrength}
        sectionHeightVh={draft.sceneHeight}
        saveStatus={saveStatus}
        onProjectTitleChange={(value) => updateDraft((current) => ({ ...current, title: value }))}
        onSectionTitleChange={(value) => updateDraft((current) => ({ ...current, sceneName: value }))}
        onFrameRangeChange={(field, value) =>
          updateDraft((current) => {
            const nextFrameRangeStart =
              field === "start" ? Math.max(0, value) : current.frameRangeStart;
            const requestedFrameRangeEnd =
              field === "end" ? Math.max(value, nextFrameRangeStart + 1) : current.frameRangeEnd;
            return {
              ...current,
              frameRangeStart: nextFrameRangeStart,
              frameRangeEnd: Math.max(requestedFrameRangeEnd, nextFrameRangeStart + 1),
            };
          })
        }
        onSectionFieldChange={(field, value) => updateDraft((current) => ({
                ...current,
                ...(field === "scrubStrength" ? { scrubStrength: value } : { sceneHeight: value }),
              }))}
        previewMode={previewMode}
        isPlaying={isPlaying}
        onPreviewModeChange={setPreviewMode}
        onRetrySync={async () => {
          await flushRemoteSync();
        }}
        onPreview={handlePreview}
        onPublish={handlePublish}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left sidebar */}
        <SidebarPanel
          projectId={projectState.id}
          activeContext={activeSidebarContext}
          selectedOverlay={selectedOverlay}
          selectedGroupChildren={selectedGroupChildren}
          canGroupSelection={canGroupSelection}
          canUngroupSelection={canUngroupSelection}
          onContextChange={(context) => {
            if (context === "upload" || context === "ai") {
              setSelection({ clipId: "section-range", trackType: "section" });
            }
            setActiveSidebarContext(context);
          }}
          onGroupSelection={handleGroupSelection}
          onUngroupSelection={() => {
            if (selectedGroupOverlay && isGroupOverlay(selectedGroupOverlay)) {
              handleUngroupOverlay(selectedGroupOverlay.id);
            }
          }}
          onSelectGroupChild={(overlayId) => selectOverlay(overlayId)}
          onOverlayFieldChange={(field, value) => {
            updateSelectedOverlay((overlay) => {
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
                          label:
                            field === "ctaLabel"
                              ? String(value)
                              : hydrated.content.cta?.label ?? "",
                          href:
                            field === "ctaHref"
                              ? String(value)
                              : hydrated.content.cta?.href ?? "",
                        }
                      : hydrated.content.cta,
                },
              };
            });
          }}
          onOverlayStyleChange={(field, value) => {
            updateSelectedOverlay((overlay) => {
              const hydrated = hydrateOverlay(overlay);
              const nextBackground = {
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
              const backgroundEnabled =
                field === "backgroundEnabled"
                  ? Boolean(value)
                  : field === "backgroundOpacity"
                    ? Number(value) > 0
                    : field === "backgroundColor"
                      ? nextBackground.opacity > 0
                      : hydrated.content.background.enabled;
              return {
                ...hydrated,
                content: {
                  ...hydrated.content,
                  style:
                    field === "width" || field === "height" || field === "x" || field === "y"
                      ? hydrated.content.style
                      : {
                          ...hydrated.content.style,
                        ...(field === "layer" ? {} : { [field]: value }),
                      },
                  background: {
                    ...nextBackground,
                    enabled: backgroundEnabled,
                    mode: backgroundEnabled ? "solid" : "transparent",
                  },
                  layout:
                    field === "width" || field === "height" || field === "x" || field === "y"
                      ? { ...hydrated.content.layout, [field]: Number(value) }
                      : hydrated.content.layout,
                },
              };
            });
          }}
          onOverlayStyleLiveChange={(field, value) => {
            if (!selectedOverlay) {
              return;
            }
            handleOverlayStyleQuickChange(selectedOverlay.id, { [field]: value });
          }}
          onOverlayAnimationChange={(field, value) => {
            updateSelectedOverlay((overlay) => {
              const hydrated = hydrateOverlay(overlay);
              return {
                ...hydrated,
                content: {
                  ...hydrated.content,
                  animation: { ...hydrated.content.animation, [field]: value },
                },
              };
            });
          }}
          onOverlayTransitionChange={(field, value) => {
            updateSelectedOverlay((overlay) => {
              const hydrated = hydrateOverlay(overlay);
              return {
                ...hydrated,
                content: {
                  ...hydrated.content,
                  transition: { ...hydrated.content.transition, [field]: value },
                },
              };
            });
          }}
          onAddContent={addOverlay}
        />

        {/* Canvas + Timeline column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Canvas */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <PreviewStage
              manifest={editorManifest}
              mode={previewMode}
              playheadProgress={playhead}
              isPlaying={isPlaying}
              selectedOverlayId={selectedOverlayId}
              selectedOverlayIds={multiSelectedOverlayIds}
              canGroupSelection={canGroupSelection}
              canUngroupSelection={canUngroupSelection}
              onModeChange={setPreviewMode}
              onPlayheadChange={(value) => {
                const nextPlayhead = clampProgress(value);
                setIsPlaying(false);
                playheadRef.current = nextPlayhead;
                setPlayhead(nextPlayhead);
              }}
              onPlayToggle={() => setIsPlaying((current) => !current)}
              onSelectOverlay={(overlayId, options) => selectOverlay(overlayId, options)}
              onOverlayLayoutChange={(overlayId, layout, options) => {
                updateDraft((current) => {
                  const target = getOverlayById(current.overlays, overlayId);
                  if (!target || target.content.parentGroupId) {
                    return current;
                  }

                  const hydratedTarget = hydrateOverlay(target);
                  const previousLayout = hydratedTarget.content.layout;
                  const nextLayout = {
                    x: previousLayout.x,
                    y: previousLayout.y,
                    width: previousLayout.width,
                    height: previousLayout.height,
                    ...layout,
                  };

                  const buildUpdatedOverlay = (overlay: HydratedOverlayDefinition) => {
                    if (options?.intent !== "resize") {
                      return {
                        ...overlay,
                        content: {
                          ...overlay.content,
                          layout: nextLayout,
                        },
                      };
                    }

                    const scaleX = Math.max(0.35, Math.min(options.scaleX ?? 1, 4));
                    const scaleY = Math.max(0.35, Math.min(options.scaleY ?? 1, 4));
                    const styleChanges = options.styleChanges;
                    const backgroundChanges = options.backgroundChanges;
                    const areaScale = Math.sqrt(scaleX * scaleY);
                    const contentScale = Math.max(0.5, Math.min(1 + (areaScale - 1) * 0.82, 3));
                    const paddingScaleX = Math.max(0.5, Math.min(1 + (scaleX - 1) * 0.72, 3));
                    const paddingScaleY = Math.max(0.5, Math.min(1 + (scaleY - 1) * 0.72, 3));

                    return {
                      ...overlay,
                      content: {
                        ...overlay.content,
                        layout: nextLayout,
                        style: {
                          ...overlay.content.style,
                          fontSize: Number(styleChanges?.fontSize ?? Math.max(10, Math.round(overlay.content.style.fontSize * contentScale))),
                          maxWidth: Number(styleChanges?.maxWidth ?? Math.max(80, Math.round((overlay.content.style.maxWidth ?? nextLayout.width ?? 420) * scaleX))),
                        },
                        background: {
                          ...overlay.content.background,
                          radius: Number(backgroundChanges?.radius ?? Math.max(0, Math.round(overlay.content.background.radius * contentScale))),
                          paddingX: Number(backgroundChanges?.paddingX ?? Math.max(0, Math.round(overlay.content.background.paddingX * paddingScaleX))),
                          paddingY: Number(backgroundChanges?.paddingY ?? Math.max(0, Math.round(overlay.content.background.paddingY * paddingScaleY))),
                        },
                      },
                    };
                  };

                  const deltaX = (nextLayout.x ?? previousLayout.x) - previousLayout.x;
                  const deltaY = (nextLayout.y ?? previousLayout.y) - previousLayout.y;
                  const nextOverlays = current.overlays.map((overlay) => {
                    if (overlay.id === overlayId) {
                      return buildUpdatedOverlay(hydrateOverlay(overlay));
                    }
                    if (
                      options?.intent !== "resize" &&
                      isGroupOverlay(hydratedTarget) &&
                      overlay.content.parentGroupId === overlayId
                    ) {
                      return shiftOverlayAbsoluteLayout(hydrateOverlay(overlay), deltaX, deltaY);
                    }
                    return overlay;
                  });

                  return {
                    ...current,
                    overlays: nextOverlays,
                  };
                });
              }}
              onInlineTextChange={(overlayId, field, value, htmlValue) => {
                updateDraft((current) => ({
                  ...current,
                  overlays: current.overlays.map((overlay) =>
                    overlay.id === overlayId
                      ? {
                          ...overlay,
                          content: {
                            ...overlay.content,
                            [field]: value,
                            textHtml: htmlValue || undefined,
                          },
                        }
                      : overlay,
                  ),
                }));
              }}
            onOverlayStyleChange={handleOverlayStyleQuickChange}
              onDuplicateOverlay={handleDuplicateOverlay}
              onDeleteOverlay={handleDeleteOverlay}
              onGroupSelection={handleGroupSelection}
              onUngroupSelection={() => {
                if (selectedGroupOverlay && isGroupOverlay(selectedGroupOverlay)) {
                  handleUngroupOverlay(selectedGroupOverlay.id);
                }
              }}
              onMoveSelection={handleMoveSelection}
              onDuplicateSelection={handleDuplicateSelection}
              onDeleteSelection={handleDeleteSelection}
            />
        </div>

          {/* Timeline */}
          <div
            className="h-[292px] flex-shrink-0 overflow-hidden border-t"
            style={{ borderColor: "var(--editor-border)" }}
          >
            <TimelinePanel
              tracks={timelineTracks}
              selection={selection}
              selectedClipIds={selectedTimelineClipIds}
              playhead={playhead}
              durationSeconds={durationSeconds}
              isPlaying={isPlaying}
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
              canGroupSelection={canGroupSelection}
              canUngroupSelection={canUngroupSelection}
              onPlayToggle={() => setIsPlaying((current) => !current)}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onGroupSelection={handleGroupSelection}
              onUngroupSelection={() => {
                if (selectedGroupOverlay && isGroupOverlay(selectedGroupOverlay)) {
                  handleUngroupOverlay(selectedGroupOverlay.id);
                }
              }}
              onPlayheadChange={(value) => {
                const nextPlayhead = clampProgress(value);
                setIsPlaying(false);
                playheadRef.current = nextPlayhead;
                setPlayhead(nextPlayhead);
              }}
              onSelectionChange={handleSelectionChange}
              onClipTimingChange={handleClipTimingChange}
              onCommitClipMove={handleCommitClipMove}
              onAddLayer={handleAddLayer}
              onDeleteLayer={handleDeleteLayer}
              onAddAtPlayhead={() => addOverlay("text")}
              onDuplicateClip={handleDuplicateClip}
              onDeleteClip={handleDeleteClip}
              onMoveClipToLayer={handleMoveClipToLayer}
              onMoveClipToNewLayer={handleMoveClipToNewLayer}
              onReorderTracks={handleReorderOverlays}
              onSetClipTransitionPreset={handleSetClipTransitionPreset}
            />
          </div>
        </div>

      </div>
    </main>
  );
}
