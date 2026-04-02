"use client";

import { useCallback, useMemo } from "react";
import type {
  OverlayDefinition,
  ProjectDraftDocument,
  ProjectManifest,
} from "@motionroll/shared";
import { toast } from "sonner";
import { createLocalPreviewSession } from "@/lib/local-preview-session";
import { normalizeFrameRange } from "@/lib/manifest-helpers";
import type { TimelineSelection } from "../timeline-model";
import type { UseEditorPlaybackReturn } from "./useEditorPlayback";
import {
  DEFAULT_BOOKMARK_TITLE,
  buildTimelineSelection,
  buildTimelineTracks,
  clampUnit,
  createId,
  createMediaLayer,
  createTextLayer,
  getDefaultTextStyle,
  isVideoLayer,
  normalizeTiming,
  reindexLayers,
  sortLayers,
  type ProjectAssetWithVariants,
} from "../project-builder-restored.helpers";
import type { EditorContainerProps } from "../editor-types";

type UseProjectEditorActionsArgs = {
  applyDraftUpdate: (updater: (current: ProjectDraftDocument) => ProjectDraftDocument) => void;
  draft: ProjectDraftDocument;
  draftRef: React.MutableRefObject<ProjectDraftDocument>;
  orderedBookmarks: ProjectDraftDocument["bookmarks"];
  orderedLayers: ProjectDraftDocument["layers"];
  insertableAssets: ProjectAssetWithVariants[];
  playback: UseEditorPlaybackReturn;
  previewManifest: ProjectManifest;
  previewMode: "desktop" | "mobile";
  projectState: EditorContainerProps["project"];
  refreshProjectRuntimeState: () => Promise<void>;
  saveDraftNow: () => Promise<boolean>;
  selectedBookmarkId: string;
  selectedLayerId: string;
  setSelectedBookmarkId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedLayerId: React.Dispatch<React.SetStateAction<string>>;
};

export function useProjectEditorActions({
  applyDraftUpdate,
  draft,
  draftRef,
  orderedBookmarks,
  orderedLayers,
  insertableAssets,
  playback,
  previewManifest,
  previewMode,
  projectState,
  refreshProjectRuntimeState,
  saveDraftNow,
  selectedBookmarkId,
  selectedLayerId,
  setSelectedBookmarkId,
  setSelectedLayerId,
}: UseProjectEditorActionsArgs) {
  const seekToBookmark = useCallback((bookmarkId: string) => {
    const bookmark = draftRef.current.bookmarks.find((item) => item.id === bookmarkId);
    if (!bookmark) {
      return;
    }
    playback.seekPlayhead(bookmark.position);
    setSelectedBookmarkId(bookmark.id);
    setSelectedLayerId("");
  }, [draftRef, playback, setSelectedBookmarkId, setSelectedLayerId]);

  const updateLayer = useCallback((layerId: string, updater: (layer: OverlayDefinition) => OverlayDefinition) => {
    applyDraftUpdate((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === layerId ? updater(layer) : layer)),
    }));
  }, [applyDraftUpdate]);

  const handleAddBookmark = useCallback(() => {
    const bookmark = {
      id: createId("bookmark"),
      title: `${DEFAULT_BOOKMARK_TITLE} ${draftRef.current.bookmarks.length + 1}`,
      position: playback.playheadRef.current,
    };
    applyDraftUpdate((current) => ({
      ...current,
      bookmarks: [...current.bookmarks, bookmark],
    }));
    setSelectedBookmarkId(bookmark.id);
    setSelectedLayerId("");
  }, [applyDraftUpdate, draftRef, playback.playheadRef, setSelectedBookmarkId, setSelectedLayerId]);

  const handleDeleteBookmark = useCallback((bookmarkId: string) => {
    applyDraftUpdate((current) => ({
      ...current,
      bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
    }));
    setSelectedBookmarkId((current) => (current === bookmarkId ? "" : current));
  }, [applyDraftUpdate, setSelectedBookmarkId]);

  const handleAddTextLayer = useCallback(() => {
    const nextLayer = createTextLayer(playback.playheadRef.current, orderedLayers.length);
    applyDraftUpdate((current) => ({
      ...current,
      layers: [...current.layers, nextLayer],
    }));
    setSelectedLayerId(nextLayer.id);
    setSelectedBookmarkId("");
  }, [applyDraftUpdate, orderedLayers.length, playback.playheadRef, setSelectedBookmarkId, setSelectedLayerId]);

  const handleAddMediaLayer = useCallback((asset: ProjectAssetWithVariants) => {
    const nextLayer = createMediaLayer({
      asset,
      assets: projectState.assets as ProjectAssetWithVariants[],
      playhead: playback.playheadRef.current,
      layerIndex: orderedLayers.length,
    });
    applyDraftUpdate((current) => ({
      ...current,
      layers: [...current.layers, nextLayer],
    }));
    setSelectedLayerId(nextLayer.id);
    setSelectedBookmarkId("");
  }, [applyDraftUpdate, orderedLayers.length, playback.playheadRef, projectState.assets, setSelectedBookmarkId, setSelectedLayerId]);

  const duplicateLayer = useCallback((layerId: string) => {
    const source = draftRef.current.layers.find((layer) => layer.id === layerId);
    if (!source) {
      return;
    }

    const copy: OverlayDefinition = {
      ...structuredClone(source),
      id: createId("layer"),
      timing: normalizeTiming(source.timing.start + 0.03, source.timing.end + 0.03),
    };

    applyDraftUpdate((current) => ({
      ...current,
      layers: [...current.layers, copy],
    }));
    setSelectedLayerId(copy.id);
    setSelectedBookmarkId("");
  }, [applyDraftUpdate, draftRef, setSelectedBookmarkId, setSelectedLayerId]);

  const deleteLayer = useCallback((layerId: string) => {
    applyDraftUpdate((current) => ({
      ...current,
      layers: current.layers.filter((layer) => layer.id !== layerId),
    }));
    setSelectedLayerId((current) => (current === layerId ? "" : current));
  }, [applyDraftUpdate, setSelectedLayerId]);

  const handleVideoInserted = useCallback((payload: {
    usage: "scene_background" | "video_layer";
    asset: { id: string; publicUrl: string; storageKey?: string; metadata?: unknown };
  }) => {
    handleAddMediaLayer({
      id: payload.asset.id,
      kind: "media_video",
      publicUrl: payload.asset.publicUrl,
      storageKey: payload.asset.storageKey ?? "",
      metadata: payload.asset.metadata,
    });
  }, [handleAddMediaLayer]);

  const handleSetSelectedLayerAsBackground = useCallback(() => {
    const layer = draftRef.current.layers.find((item) => item.id === selectedLayerId);
    if (!layer || !isVideoLayer(layer) || !layer.content.mediaUrl) {
      return;
    }

    applyDraftUpdate((current) => ({
      ...current,
      canvas: {
        ...current.canvas,
        backgroundTrack: {
          id: "background-track",
          start: layer.timing.start,
          end: layer.timing.end,
          media: {
            assetId: layer.content.mediaAssetId,
            url: layer.content.mediaUrl!,
            previewUrl: layer.content.mediaPreviewUrl ?? layer.content.mediaUrl!,
            metadata: layer.content.mediaMetadata,
          },
          endBehavior: "loop",
        },
      },
    }));
  }, [applyDraftUpdate, draftRef, selectedLayerId]);

  const handlePreview = useCallback(async () => {
    await saveDraftNow();
    const params = new URLSearchParams({ mode: previewMode, draftSource: "local" });
    const sessionId = createLocalPreviewSession(projectState.id, previewManifest);
    if (sessionId) {
      params.set("session", sessionId);
    }
    window.open(`/projects/${projectState.id}/preview?${params.toString()}`, "_blank");
  }, [previewManifest, previewMode, projectState.id, saveDraftNow]);

  const handlePublish = useCallback(async () => {
    const didSave = await saveDraftNow();
    if (!didSave) {
      return;
    }
    window.location.href = `/projects/${projectState.id}/publish`;
  }, [projectState.id, saveDraftNow]);

  const handleProjectThumbnailUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/projects/${projectState.id}/thumbnail`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      toast.error("Thumbnail upload failed.");
      return;
    }
    await refreshProjectRuntimeState();
  }, [projectState.id, refreshProjectRuntimeState]);

  const handleProjectThumbnailReset = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectState.id}/thumbnail`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Thumbnail reset failed.");
      return;
    }
    await refreshProjectRuntimeState();
  }, [projectState.id, refreshProjectRuntimeState]);

  const handleSaveProjectSettings = useCallback(async (values: {
    projectTitle: string;
    bookmarkTitle: string;
    frameRangeStart: number;
    frameRangeEnd: number;
    scrubStrength: number;
    sectionHeightVh: number;
  }) => {
    const targetBookmarkId = selectedBookmarkId || draftRef.current.bookmarks[0]?.id;
    applyDraftUpdate((current) => ({
      ...current,
      title: values.projectTitle,
      canvas: {
        ...current.canvas,
        frameRange: normalizeFrameRange(
          {
            start: Math.round(values.frameRangeStart),
            end: Math.round(values.frameRangeEnd),
          },
          Math.max(values.frameRangeEnd + 1, 2),
        ),
        scrollHeightVh: values.sectionHeightVh,
        scrubStrength: values.scrubStrength,
      },
      bookmarks: targetBookmarkId
        ? current.bookmarks.map((bookmark) =>
            bookmark.id === targetBookmarkId
              ? { ...bookmark, title: values.bookmarkTitle.trim() || bookmark.title }
              : bookmark,
          )
        : current.bookmarks,
    }));
  }, [applyDraftUpdate, draftRef, selectedBookmarkId]);

  const handleBookmarkFieldChange = useCallback((field: "title" | "position", value: string | number) => {
    if (!selectedBookmarkId) {
      return;
    }
    applyDraftUpdate((current) => ({
      ...current,
      bookmarks: current.bookmarks.map((bookmark) =>
        bookmark.id === selectedBookmarkId
          ? {
              ...bookmark,
              [field]: field === "position" ? clampUnit(Number(value)) : String(value),
            }
          : bookmark,
      ),
    }));
  }, [applyDraftUpdate, selectedBookmarkId]);

  const handleCanvasFieldChange = useCallback((
    field: "frameRangeStart" | "frameRangeEnd" | "scrollHeightVh" | "scrubStrength" | "backgroundColor",
    value: string | number,
  ) => {
    applyDraftUpdate((current) => {
      if (field === "backgroundColor") {
        return {
          ...current,
          canvas: {
            ...current.canvas,
            backgroundColor: String(value),
          },
        };
      }

      if (field === "frameRangeStart" || field === "frameRangeEnd") {
        return {
          ...current,
          canvas: {
            ...current.canvas,
            frameRange: {
              ...current.canvas.frameRange,
              [field === "frameRangeStart" ? "start" : "end"]: Math.round(Number(value)),
            },
          },
        };
      }

      return {
        ...current,
        canvas: {
          ...current.canvas,
          [field]: Number(value),
        },
      };
    });
  }, [applyDraftUpdate]);

  const handleOverlayFieldChange = useCallback((field: string, value: string | number) => {
    if (!selectedLayerId) {
      return;
    }
    updateLayer(selectedLayerId, (layer) => ({
      ...layer,
      content: {
        ...layer.content,
        [field]: value,
      },
    }));
  }, [selectedLayerId, updateLayer]);

  const handleOverlayStyleChange = useCallback((field: string, value: string | number | boolean) => {
    if (!selectedLayerId) {
      return;
    }
    updateLayer(selectedLayerId, (layer) => ({
      ...layer,
      content: {
        ...layer.content,
        style: {
          ...getDefaultTextStyle(),
          ...layer.content.style,
          [field]: value,
        },
      },
    }));
  }, [selectedLayerId, updateLayer]);

  const handleOverlayAnimationChange = useCallback((
    phase: "enterAnimation" | "exitAnimation",
    field: string,
    value: string | number,
  ) => {
    if (!selectedLayerId) {
      return;
    }
    updateLayer(selectedLayerId, (layer) => ({
      ...layer,
      content: {
        ...layer.content,
        [phase]: {
          ...(phase === "enterAnimation"
            ? layer.content.enterAnimation ?? { type: "fade", easing: "ease-out", duration: 0.35, delay: 0 }
            : layer.content.exitAnimation ?? { type: "none", easing: "ease-in-out", duration: 0.2 }),
          [field]: value,
        },
      },
    }));
  }, [selectedLayerId, updateLayer]);

  const handleAddContent = useCallback((type: string) => {
    if (type === "text") {
      handleAddTextLayer();
      return;
    }

    const preferredAsset =
      insertableAssets.find((asset) => asset.kind !== "media_video" && asset.kind !== "fallback_video") ??
      insertableAssets[0];

    if (!preferredAsset) {
      toast.info("Upload media first, then add it to the canvas.");
      return;
    }

    handleAddMediaLayer(preferredAsset);
  }, [handleAddMediaLayer, handleAddTextLayer, insertableAssets]);

  const handleDeleteLayerTrack = useCallback((rowIndex: number) => {
    const layer = orderedLayers[rowIndex];
    if (layer) {
      deleteLayer(layer.id);
    }
  }, [deleteLayer, orderedLayers]);

  const timelineTracks = useMemo(
    () =>
      buildTimelineTracks({
        draft,
        orderedBookmarks,
        orderedLayers,
        selectedBookmarkId,
      }),
    [draft, orderedBookmarks, orderedLayers, selectedBookmarkId],
  );

  const timelineSelection = useMemo(
    () => buildTimelineSelection(selectedLayerId, selectedBookmarkId),
    [selectedBookmarkId, selectedLayerId],
  );

  const selectedClipIds = useMemo(
    () => (timelineSelection ? [timelineSelection.clipId] : []),
    [timelineSelection],
  );

  const handleTimelineSelectionChange = useCallback((selection: TimelineSelection) => {
    if (!selection) {
      setSelectedLayerId("");
      setSelectedBookmarkId("");
      return;
    }
    if (selection.trackType === "section") {
      seekToBookmark(selection.clipId.replace(/^bookmark-/, ""));
      return;
    }
    setSelectedLayerId(selection.clipId);
    setSelectedBookmarkId("");
  }, [seekToBookmark, setSelectedBookmarkId, setSelectedLayerId]);

  const handleTimelineClipTimingChange = useCallback((clipId: string, timing: { start: number; end: number }) => {
    updateLayer(clipId, (layer) => ({
      ...layer,
      timing: normalizeTiming(timing.start, timing.end),
    }));
  }, [updateLayer]);

  const handleCommitClipMove = useCallback((move: { clipId: string; start: number; end: number; targetLayer?: number }) => {
    const nextTiming = normalizeTiming(move.start, move.end);
    applyDraftUpdate((current) => {
      const ordered = sortLayers(current.layers);
      const sourceIndex = ordered.findIndex((layer) => layer.id === move.clipId);
      if (sourceIndex < 0) {
        return current;
      }

      const [sourceLayer] = ordered.splice(sourceIndex, 1);
      if (!sourceLayer) {
        return current;
      }

      const targetIndex =
        typeof move.targetLayer === "number"
          ? Math.max(0, Math.min(move.targetLayer, ordered.length))
          : sourceIndex;

      ordered.splice(targetIndex, 0, { ...sourceLayer, timing: nextTiming });
      return {
        ...current,
        layers: reindexLayers(ordered),
      };
    });
  }, [applyDraftUpdate]);

  const handleMoveClipToLayer = useCallback((clipId: string, layerIndex: number) => {
    applyDraftUpdate((current) => {
      const ordered = sortLayers(current.layers);
      const sourceIndex = ordered.findIndex((layer) => layer.id === clipId);
      if (sourceIndex < 0) {
        return current;
      }

      const [sourceLayer] = ordered.splice(sourceIndex, 1);
      if (!sourceLayer) {
        return current;
      }

      ordered.splice(Math.max(0, Math.min(layerIndex, ordered.length)), 0, sourceLayer);
      return {
        ...current,
        layers: reindexLayers(ordered),
      };
    });
  }, [applyDraftUpdate]);

  const handleMoveClipToNewLayer = useCallback((clipId: string) => {
    applyDraftUpdate((current) => {
      const ordered = sortLayers(current.layers);
      const sourceIndex = ordered.findIndex((layer) => layer.id === clipId);
      if (sourceIndex < 0) {
        return current;
      }

      const [sourceLayer] = ordered.splice(sourceIndex, 1);
      if (!sourceLayer) {
        return current;
      }

      ordered.unshift(sourceLayer);
      return {
        ...current,
        layers: reindexLayers(ordered),
      };
    });
  }, [applyDraftUpdate]);

  const handleReorderTracks = useCallback((fromIndex: number, toIndex: number) => {
    applyDraftUpdate((current) => {
      const ordered = sortLayers(current.layers);
      if (!ordered[fromIndex]) {
        return current;
      }
      const targetIndex = Math.max(0, Math.min(toIndex, ordered.length - 1));
      const nextLayers = [...ordered];
      const [moved] = nextLayers.splice(fromIndex, 1);
      if (!moved) {
        return current;
      }
      nextLayers.splice(targetIndex, 0, moved);
      return {
        ...current,
        layers: reindexLayers(nextLayers),
      };
    });
  }, [applyDraftUpdate]);

  return {
    deleteLayer,
    duplicateLayer,
    handleAddBookmark,
    handleAddContent,
    handleAddMediaLayer,
    handleAddTextLayer,
    handleBookmarkFieldChange,
    handleCanvasFieldChange,
    handleCommitClipMove,
    handleDeleteBookmark,
    handleDeleteLayerTrack,
    handleMoveClipToLayer,
    handleMoveClipToNewLayer,
    handleOverlayAnimationChange,
    handleOverlayFieldChange,
    handleOverlayStyleChange,
    handlePreview,
    handleProjectThumbnailReset,
    handleProjectThumbnailUpload,
    handlePublish,
    handleReorderTracks,
    handleSaveProjectSettings,
    handleSetSelectedLayerAsBackground,
    handleTimelineClipTimingChange,
    handleTimelineSelectionChange,
    handleVideoInserted,
    seekToBookmark,
    selectedClipIds,
    timelineSelection,
    timelineTracks,
    updateLayer,
  };
}
