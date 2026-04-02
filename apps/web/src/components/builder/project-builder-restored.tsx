"use client";

import { useCallback, useMemo, useState } from "react";
import type { ProjectDraftDocument } from "@motionroll/shared";
import { PreviewStage } from "./preview-stage";
import { SidebarPanel } from "./editor-sidebar";
import { TopBar } from "./editor-top-bar";
import { TimelinePanel } from "./timeline-panel";
import type { EditorContainerProps } from "./editor-types";
import { useEditorPlayback } from "./hooks/useEditorPlayback";
import { useProjectEditorActions } from "./hooks/useProjectEditorActions";
import { useProjectEditorPersistence } from "./hooks/useProjectEditorPersistence";
import { useProjectEditorPreviewHandlers } from "./hooks/useProjectEditorPreviewHandlers";
import { useProjectEditorSelectionState } from "./hooks/useProjectEditorSelectionState";
import {
  buildInitialDraft,
  buildPreviewManifest,
  isVideoLayer,
  normalizeDraftDocument,
  type ProjectAssetWithVariants,
} from "./project-builder-restored.helpers";
import { getProjectCoverUrl, sortProjectAssets } from "@/lib/project-assets";

export function ProjectEditor({ project, projects, manifest }: EditorContainerProps) {
  const initialDraft = useMemo(
    () => buildInitialDraft(project, manifest),
    [manifest, project],
  );

  const [draft, setDraft] = useState(initialDraft);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  const applyDraftUpdate = useCallback((updater: (current: ProjectDraftDocument) => ProjectDraftDocument) => {
    setDraft((current) => normalizeDraftDocument(updater(current)));
  }, []);

  const {
    orderedBookmarks,
    orderedLayers,
    selectedBookmark,
    selectedBookmarkId,
    selectedLayer,
    selectedLayerId,
    setSelectedBookmarkId,
    setSelectedLayerId,
    setSidebarContext,
    sidebarContext,
  } = useProjectEditorSelectionState(draft);

  const durationSeconds = useMemo(
    () => Math.max((draft.canvas.frameRange.end - draft.canvas.frameRange.start + 1) / 24, 1 / 24),
    [draft.canvas.frameRange.end, draft.canvas.frameRange.start],
  );
  const playback = useEditorPlayback(durationSeconds);

  const {
    draftRef,
    manifestState,
    projectState,
    refreshProjectRuntimeState,
    saveDraftNow,
    topBarSaveStatus,
  } = useProjectEditorPersistence({
    project,
    manifest,
    initialDraft,
    draft,
  });

  const previewManifest = useMemo(() => buildPreviewManifest(manifestState, draft), [draft, manifestState]);

  const insertableAssets = useMemo(() => {
    const assets = sortProjectAssets(projectState.assets as ProjectAssetWithVariants[]);
    return assets.filter((asset) =>
      ["media_video", "fallback_video", "poster", "thumbnail"].includes(asset.kind),
    );
  }, [projectState.assets]);

  const {
    deleteLayer,
    duplicateLayer,
    handleAddBookmark,
    handleAddContent,
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
    handleOverlayStyleChange: handleInspectorOverlayStyleChange,
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
  } = useProjectEditorActions({
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
  });

  const {
    handleInlineTextChange,
    handleOverlayLayoutChange,
    handleOverlayStyleChange,
    handleOverlayStyleLiveChange,
    handleSelectOverlay,
  } = useProjectEditorPreviewHandlers({
    updateLayer,
    setSelectedBookmarkId,
    setSelectedLayerId,
  });

  const projectCoverUrl = useMemo(() => getProjectCoverUrl(projectState), [projectState]);
  const hasThumbnailOverride = useMemo(
    () => projectState.assets.some((asset) => asset.kind === "thumbnail"),
    [projectState.assets],
  );

  return (
    <main className="flex h-screen min-h-screen flex-col overflow-hidden bg-[var(--editor-shell)] text-[var(--editor-text)]">
      <TopBar
        projectId={projectState.id}
        projectName={draft.title}
        bookmarkTitle={selectedBookmark?.title ?? orderedBookmarks[0]?.title ?? "Canvas"}
        frameRangeStart={draft.canvas.frameRange.start}
        frameRangeEnd={draft.canvas.frameRange.end}
        scrubStrength={draft.canvas.scrubStrength}
        sectionHeightVh={draft.canvas.scrollHeightVh}
        currentProjectCoverUrl={projectCoverUrl}
        hasThumbnailOverride={hasThumbnailOverride}
        previewMode={previewMode}
        isPlaying={playback.isPlaying}
        projects={projects}
        saveStatus={topBarSaveStatus}
        onSaveProjectSettings={handleSaveProjectSettings}
        onProjectThumbnailUpload={handleProjectThumbnailUpload}
        onProjectThumbnailReset={handleProjectThumbnailReset}
        onPreviewModeChange={setPreviewMode}
        onPreview={handlePreview}
        onPublish={handlePublish}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SidebarPanel
          projectId={projectState.id}
          activeContext={sidebarContext}
          selectedOverlay={selectedLayer}
          selectedBookmark={selectedBookmark ? {
            id: selectedBookmark.id,
            title: selectedBookmark.title,
            position: selectedBookmark.position,
          } : undefined}
          canvasSettings={selectedLayer ? undefined : {
            title: draft.title,
            frameRangeStart: draft.canvas.frameRange.start,
            frameRangeEnd: draft.canvas.frameRange.end,
            scrollHeightVh: draft.canvas.scrollHeightVh,
            scrubStrength: draft.canvas.scrubStrength,
            backgroundColor: draft.canvas.backgroundColor,
            backgroundMedia: draft.canvas.backgroundTrack?.media,
            backgroundVideoEndBehavior: draft.canvas.backgroundTrack?.endBehavior,
          }}
          canSetSelectedOverlayAsBackground={Boolean(selectedLayer && isVideoLayer(selectedLayer))}
          onContextChange={setSidebarContext}
          onBookmarkFieldChange={handleBookmarkFieldChange}
          onBookmarkJump={() => { if (selectedBookmark) seekToBookmark(selectedBookmark.id); }}
          onDeleteBookmark={() => { if (selectedBookmark) handleDeleteBookmark(selectedBookmark.id); }}
          onCanvasFieldChange={handleCanvasFieldChange}
          onCanvasBackgroundColorChange={(value) => handleCanvasFieldChange("backgroundColor", value)}
          onCanvasBackgroundEndBehaviorChange={(value) => applyDraftUpdate((current) => ({
            ...current,
            canvas: current.canvas.backgroundTrack
              ? { ...current.canvas, backgroundTrack: { ...current.canvas.backgroundTrack, endBehavior: value } }
              : current.canvas,
          }))}
          onDetachCanvasBackground={() => applyDraftUpdate((current) => ({
            ...current,
            canvas: { ...current.canvas, backgroundTrack: undefined },
          }))}
          onRemoveCanvasBackground={() => applyDraftUpdate((current) => ({
            ...current,
            canvas: { ...current.canvas, backgroundTrack: undefined },
          }))}
          onOverlayFieldChange={handleOverlayFieldChange}
          onOverlayStyleChange={handleInspectorOverlayStyleChange}
          onOverlayStyleLiveChange={handleInspectorOverlayStyleChange}
          onOverlayStyleLiveCommit={handleInspectorOverlayStyleChange}
          onOverlayEnterAnimationChange={(field, value) => handleOverlayAnimationChange("enterAnimation", field, value)}
          onOverlayExitAnimationChange={(field, value) => handleOverlayAnimationChange("exitAnimation", field, value)}
          onAddContent={handleAddContent}
          onSetSelectedOverlayAsBackground={handleSetSelectedLayerAsBackground}
          onUploadQueued={() => { void refreshProjectRuntimeState(); }}
          onVideoInserted={handleVideoInserted}
          processingJobs={projectState.jobs}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
            <PreviewStage
              manifest={previewManifest}
              mode={previewMode}
              playback={playback.playback}
              isPlaying={playback.isPlaying}
              selectedOverlayId={selectedLayerId || undefined}
              selectedOverlayIds={selectedLayerId ? [selectedLayerId] : []}
              onModeChange={setPreviewMode}
              onPlayheadChange={playback.seekPlayhead}
              onPlayToggle={playback.togglePlay}
              onSelectOverlay={handleSelectOverlay}
              onOverlayLayoutChange={handleOverlayLayoutChange}
              onInlineTextChange={handleInlineTextChange}
              onOverlayStyleLiveChange={handleOverlayStyleLiveChange}
              onOverlayStyleChange={handleOverlayStyleChange}
              onDuplicateOverlay={duplicateLayer}
              onDeleteOverlay={deleteLayer}
            />
          </div>
          <div className="h-[320px] shrink-0 border-t" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}>
            <TimelinePanel
              tracks={timelineTracks}
              selection={timelineSelection}
              selectedClipIds={selectedClipIds}
              playback={playback.playback}
              durationSeconds={durationSeconds}
              isPlaying={playback.isPlaying}
              canUndo={false}
              canRedo={false}
              canGroupSelection={false}
              canUngroupSelection={false}
              onPlayToggle={playback.togglePlay}
              onUndo={() => undefined}
              onRedo={() => undefined}
              onGroupSelection={() => undefined}
              onUngroupSelection={() => undefined}
              onPlayheadChange={playback.seekPlayhead}
              onSelectionChange={handleTimelineSelectionChange}
              onClipTimingChange={handleTimelineClipTimingChange}
              onCommitClipMove={handleCommitClipMove}
              onAddLayer={handleAddTextLayer}
              onDeleteLayer={handleDeleteLayerTrack}
              onAddAtPlayhead={handleAddTextLayer}
              onDuplicateClip={duplicateLayer}
              onDeleteClip={deleteLayer}
              onMoveClipToLayer={handleMoveClipToLayer}
              onMoveClipToNewLayer={handleMoveClipToNewLayer}
              onSelectBookmark={seekToBookmark}
              onRenameBookmark={(bookmarkId, title) => applyDraftUpdate((current) => ({
                ...current,
                bookmarks: current.bookmarks.map((bookmark: ProjectDraftDocument["bookmarks"][number]) =>
                  bookmark.id === bookmarkId ? { ...bookmark, title } : bookmark,
                ),
              }))}
              onDuplicateBookmark={() => undefined}
              onDeleteBookmark={handleDeleteBookmark}
              onAddBookmark={handleAddBookmark}
              onAddBookmarkAfter={() => undefined}
              onReorderBookmarks={() => undefined}
              onSetClipEnterAnimationType={(clipId, type) => updateLayer(clipId, (layer) => ({
                ...layer,
                content: {
                  ...layer.content,
                  enterAnimation: {
                    ...(layer.content.enterAnimation ?? { type: "fade", easing: "ease-out", duration: 0.35, delay: 0 }),
                    type,
                  },
                },
              }))}
              onSetClipExitAnimationType={(clipId, type) => updateLayer(clipId, (layer) => ({
                ...layer,
                content: {
                  ...layer.content,
                  exitAnimation: {
                    ...(layer.content.exitAnimation ?? { type: "none", easing: "ease-in-out", duration: 0.2 }),
                    type,
                  },
                },
              }))}
              onSetBookmarkEnterTransitionPreset={() => undefined}
              onSetBookmarkExitTransitionPreset={() => undefined}
              onReorderTracks={handleReorderTracks}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
