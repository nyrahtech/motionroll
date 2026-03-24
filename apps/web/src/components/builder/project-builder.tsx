"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampProgress,
  frameIndexToSequenceProgress,
  type OverlayDefinition,
  type ProjectDraftDocument,
} from "@motionroll/shared";
import { toast } from "sonner";
import { SidebarPanel } from "./editor-sidebar";
import { TopBar } from "./editor-top-bar";
import { PreviewStage } from "./preview-stage";
import { TimelinePanel } from "./timeline-panel";
import { deriveTimelineTracks } from "./timeline-model";
import type { EditorContainerProps } from "./editor-types";
import { buildProjectDraftDocument, parseProjectDraftDocument } from "@/lib/project-draft";
import { getPrimarySourceAsset } from "@/lib/project-assets";
import {
  EditorErrorBoundary,
  PreviewErrorBoundary,
  TimelineErrorBoundary,
} from "@/components/error/ErrorBoundaries";
import { documentToEditorDraft } from "./editor-draft-utils";
import { useEditorDraft } from "./hooks/useEditorDraft";
import { useOverlayCallbacks } from "./hooks/useOverlayCallbacks";
import { useEditorPersistence } from "./hooks/useEditorPersistence";
import { useEditorPlayback } from "./hooks/useEditorPlayback";
import { useEditorSelection } from "./hooks/useEditorSelection";
import type { HydratedOverlayDefinition, EditorDraft } from "./editor-draft-types";
import {
  hydrateOverlay,
  getOverlayById,
  isGroupOverlay,
  getGroupSelectionEligibility,
  getRootOverlayId,
  getDirectGroupChildren,
  scaleSceneRangeOverlays,
  shiftOverlayAbsoluteLayout,
} from "./editor-overlay-utils";

// ── Serialization helpers (see editor-draft-utils.ts) ───────────────────────

function buildDraftManifest(
  manifest: EditorContainerProps["manifest"],
  draft: EditorDraft,
): EditorContainerProps["manifest"] {
  const section = manifest.sections[0];
  if (!section) return manifest;
  const existingSequenceTransition = section.transitions.find((transition) => transition.scope === "sequence");
  const nextTransitions =
    draft.sceneTransitionPreset === "none"
      ? []
      : [
          {
            id: existingSequenceTransition?.id ?? "scene-transition",
            scope: "sequence" as const,
            fromId: existingSequenceTransition?.fromId ?? section.id,
            toId: existingSequenceTransition?.toId ?? section.id,
            preset: draft.sceneTransitionPreset,
            easing: existingSequenceTransition?.easing ?? "ease-in-out",
            duration: existingSequenceTransition?.duration ?? 0.4,
          },
        ];
  return {
    ...manifest,
    project: { ...manifest.project, title: draft.title },
    selectedPreset: draft.presetId,
    sections: [
      {
        ...section,
        title: draft.sectionTitle,
        overlays: draft.overlays,
        transitions: nextTransitions,
        progressMapping: {
          ...section.progressMapping,
          frameRange: { start: draft.frameRangeStart, end: draft.frameRangeEnd },
        },
        motion: {
          ...section.motion,
          sectionHeightVh: draft.sectionHeightVh,
          scrubStrength: draft.scrubStrength,
        },
      },
    ],
  };
}

function getDurationSeconds(project: EditorContainerProps["project"], frameCount: number) {
  const source = getPrimarySourceAsset(project.assets);
  const metadata = (source?.metadata ?? {}) as { durationMs?: number };
  return metadata.durationMs ? metadata.durationMs / 1000 : Math.max(frameCount / 24, 8);
}

function clampPlayheadToSceneRange(
  playhead: number,
  frameRangeStart: number,
  frameRangeEnd: number,
  frameCount: number,
) {
  const safe = Math.max(frameCount, 1);
  const rangeStart = frameIndexToSequenceProgress(frameRangeStart, safe);
  const rangeEnd = frameIndexToSequenceProgress(frameRangeEnd, safe);
  return clampProgress(Math.min(Math.max(playhead, rangeStart), rangeEnd));
}

// ─────────────────────────────────────────────────────────────────────────────

export function ProjectEditor({ project, projects, manifest }: EditorContainerProps) {
  const initialRemoteDraft = project.draftJson
    ? parseProjectDraftDocument(project.draftJson)
    : buildProjectDraftDocument(project, manifest);

  const [projectState, setProjectState] = useState(project);
  const [manifestState, setManifestState] = useState(manifest);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [isProjectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const processingRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stable callback refs allow hooks to call each other without circular deps ──
  // useEditorDraft is initialized first (needs no deps), then useEditorPersistence
  // gets draftRef from it. The callbacks are wired up below after both are ready.
  const onUnsyncedChangeRef = useRef<(v: boolean) => void>(() => {});
  const onRemoteSyncStateRef = useRef<(s: "idle" | "syncing" | "synced" | "error") => void>(() => {});
  const hasUnsyncedChangesRef = useRef(false);

  // ── Draft hook ────────────────────────────────────────────────────────────
  const editorDraft = useEditorDraft(
    documentToEditorDraft(initialRemoteDraft),
    useCallback((v: boolean) => onUnsyncedChangeRef.current(v), []),
    useCallback((s: "idle" | "syncing" | "synced" | "error") => onRemoteSyncStateRef.current(s), []),
  );
  const { draft, canUndo, canRedo, draftRef, draftVersionRef, updateDraft, replaceDraftState } =
    editorDraft;

  // ── Persistence hook ──────────────────────────────────────────────────────
  const persistence = useEditorPersistence({
    projectId: project.id,
    initialDraftRevision: project.draftRevision ?? 0,
    initialUpdatedAt: new Date(
      project.lastSavedAt ?? project.updatedAt ?? new Date(),
    ).toISOString(),
    draftRef,
    draftVersionRef,
    hasUnsyncedChangesRef,
    replaceDraftStateFromDocument: useCallback(
      (doc: ProjectDraftDocument, opts?: { clearHistory?: boolean; hasUnsyncedChanges?: boolean }) => {
        replaceDraftState(documentToEditorDraft(doc), opts);
      },
      [replaceDraftState],
    ),
  });

  const {
    localSaveState,
    remoteSyncState,
    hasUnsyncedChanges,
    persistenceReadyRef,
    flushRemoteSync,
    writeDraftLocally,
    scheduleRemoteSync,
    setHasUnsyncedChanges,
    setRemoteSyncState,
  } = persistence;

  // Wire draft callbacks → persistence after both hooks are initialized
  onUnsyncedChangeRef.current = (v: boolean) => {
    setHasUnsyncedChanges(v);
    hasUnsyncedChangesRef.current = v;
  };
  onRemoteSyncStateRef.current = setRemoteSyncState;

  // ── Computed manifest ─────────────────────────────────────────────────────
  const editorManifest = useMemo(
    () => buildDraftManifest(manifestState, draft),
    [draft, manifestState],
  );
  const frameCount = editorManifest.sections[0]?.frameCount ?? 0;
  const durationSeconds = useMemo(
    () => getDurationSeconds(projectState, frameCount),
    [frameCount, projectState],
  );
  const timelineTracks = useMemo(
    () => deriveTimelineTracks(editorManifest, durationSeconds, previewMode, draft.layerCount),
    [draft.layerCount, durationSeconds, editorManifest, previewMode],
  );

  // ── Playback hook ─────────────────────────────────────────────────────────
  const { isPlaying, playback, playheadRef, seekPlayhead, togglePlay, stopPlay } =
    useEditorPlayback(durationSeconds);

  // ── Selection hook ────────────────────────────────────────────────────────
  const {
    selection,
    selectedOverlayId,
    multiSelectedOverlayIds,
    activeSidebarContext,
    setActiveSidebarContext,
    selectOverlay,
    clearSelection,
    handleSelectionChange,
    syncWithOverlays,
  } = useEditorSelection(
    manifest.sections[0]?.overlays[0]?.id ?? "",
    manifest.sections[0]?.overlays[0] ? "edit" : "insert",
    manifest.sections[0]?.overlays[0]
      ? { clipId: `layer-${manifest.sections[0].overlays[0].id}`, trackType: "layer" }
      : { clipId: "section-range", trackType: "section" },
  );

  // ── Derived selection ─────────────────────────────────────────────────────
  const selectedOverlay = draft.overlays.find((o) => o.id === selectedOverlayId);

  const {
    onOverlayFieldChange,
    onOverlayStyleChange,
    onOverlayStyleLiveChange,
    onOverlayEnterAnimationChange,
    onOverlayExitAnimationChange,
    onOverlayLayoutChange,
    onInlineTextChange,
  } = useOverlayCallbacks({
    selectedOverlayId,
    updateDraft,
    updateSelectedOverlay: editorDraft.updateSelectedOverlay,
    handleOverlayStyleQuickChange: editorDraft.handleOverlayStyleQuickChange,
  });
  const selectedTimelineClipIds = multiSelectedOverlayIds.map((id) => `layer-${id}`);
  const canGroupSelection = getGroupSelectionEligibility(draft.overlays, multiSelectedOverlayIds);
  const selectedGroupOverlay = useMemo(() => {
    if (!selectedOverlay) return undefined;
    if (isGroupOverlay(selectedOverlay)) return selectedOverlay;
    if (selectedOverlay.content.parentGroupId)
      return getOverlayById(draft.overlays, selectedOverlay.content.parentGroupId);
    return undefined;
  }, [draft.overlays, selectedOverlay]);
  const canUngroupSelection = Boolean(selectedGroupOverlay && isGroupOverlay(selectedGroupOverlay));
  const selectedGroupChildren = useMemo(() => {
    if (!selectedGroupOverlay || !isGroupOverlay(selectedGroupOverlay)) return [];
    return getDirectGroupChildren(draft.overlays, selectedGroupOverlay.id).map((child, index) => ({
      id: child.id,
      label:
        child.content.text?.split(/\r?\n/).find((l) => l.trim().length > 0) ??
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

  const refreshProjectRuntimeState = useCallback(async () => {
    const [projectResponse, manifestResponse] = await Promise.all([
      fetch(`/api/projects/${project.id}`, { method: "GET", cache: "no-store" }),
      fetch(`/api/projects/${project.id}/manifest`, { method: "GET", cache: "no-store" }),
    ]);

    if (!projectResponse.ok || !manifestResponse.ok) {
      throw new Error("Could not refresh project processing state.");
    }

    const [nextProject, nextManifest] = await Promise.all([
      projectResponse.json() as Promise<EditorContainerProps["project"]>,
      manifestResponse.json() as Promise<EditorContainerProps["manifest"]>,
    ]);

    setProjectState(nextProject);
    setManifestState(nextManifest);

    return nextProject;
  }, [project.id]);

  const stopProcessingRefresh = useCallback(() => {
    if (processingRefreshTimeoutRef.current) {
      clearTimeout(processingRefreshTimeoutRef.current);
      processingRefreshTimeoutRef.current = null;
    }
  }, []);

  const scheduleProcessingRefresh = useCallback((delayMs = 2200) => {
    stopProcessingRefresh();
    processingRefreshTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const nextProject = await refreshProjectRuntimeState();
          const hasActiveProcessingJob = nextProject.jobs?.some(
            (job) => job.status === "queued" || job.status === "processing",
          );
          if (hasActiveProcessingJob) {
            scheduleProcessingRefresh();
          }
        } catch {
          scheduleProcessingRefresh(3500);
        }
      })();
    }, delayMs);
  }, [refreshProjectRuntimeState, stopProcessingRefresh]);

  const handlePreviewStyleChange = useCallback(
    (overlayId: string, changes: Record<string, unknown>) => {
      if (overlayId !== selectedOverlayId) {
        return;
      }
      for (const [field, value] of Object.entries(changes)) {
        onOverlayStyleChange(field, value);
      }
    },
    [onOverlayStyleChange, selectedOverlayId],
  );

  // ── Effects ───────────────────────────────────────────────────────────────

  // Clamp playhead when frame range changes
  useEffect(() => {
    const next = clampPlayheadToSceneRange(
      playheadRef.current,
      draft.frameRangeStart,
      draft.frameRangeEnd,
      frameCount,
    );
    if (Math.abs(next - playheadRef.current) < 0.0005) return;
    stopPlay();
    seekPlayhead(next);
  }, [draft.frameRangeEnd, draft.frameRangeStart, frameCount, seekPlayhead, stopPlay, playheadRef]);

  // Auto-switch sidebar when selected overlay disappears
  useEffect(() => {
    if (activeSidebarContext === "edit" && !selectedOverlay) {
      setActiveSidebarContext("insert");
    }
  }, [activeSidebarContext, selectedOverlay, setActiveSidebarContext]);

  // Keep selection clean as overlays change
  useEffect(() => {
    syncWithOverlays(draft.overlays);
  }, [draft.overlays, syncWithOverlays]);

  // Write local draft + schedule remote sync whenever draft or sync state changes
  useEffect(() => {
    if (!persistenceReadyRef.current) return;
    void writeDraftLocally(draft, { dirty: hasUnsyncedChanges });
    if (hasUnsyncedChanges) scheduleRemoteSync();
  }, [draft, hasUnsyncedChanges, writeDraftLocally, scheduleRemoteSync, persistenceReadyRef]);

  // Toast on errors
  useEffect(() => {
    if (remoteSyncState === "error") toast.error("Changes couldn't sync — retrying…");
  }, [remoteSyncState]);
  useEffect(() => {
    if (localSaveState === "error") toast.error("Local save failed");
  }, [localSaveState]);
  useEffect(() => {
    const failedJob = projectState.jobs?.find((j) => j.status === "failed" && j.failureReason);
    if (failedJob) toast.error(`Processing failed: ${failedJob.failureReason ?? "unknown error"}`);
  }, [projectState.jobs]);

  useEffect(() => stopProcessingRefresh, [stopProcessingRefresh]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement).contentEditable === "true";
      if (isEditable) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); editorDraft.handleUndo(); }
      else if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); editorDraft.handleRedo(); }
      else if (e.key === "s") { e.preventDefault(); void flushRemoteSync(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // deps intentionally omit editorDraft.handleUndo/Redo/flushRemoteSync —
  // all are stable useCallback refs that don't change between renders.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────

  function openDetachedWindow(url?: string) {
    const popup = window.open(url ?? "", "_blank");
    if (popup) {
      try {
        popup.opener = null;
      } catch {
        // Some browsers restrict opener writes; best effort is enough here.
      }
    }
    return popup;
  }

  async function handlePreview() {
    const previewUrl = `/projects/${projectState.id}/preview`;
    if (!hasUnsyncedChangesRef.current) { openDetachedWindow(previewUrl); return; }
    const pw = openDetachedWindow();
    const didFlush = await flushRemoteSync();
    if (!didFlush) {
      pw?.close();
      toast.error("MotionRoll couldn't sync the latest draft for preview yet.");
      return;
    }
    if (pw && !pw.closed) { pw.location.replace(previewUrl); return; }
    openDetachedWindow(previewUrl);
  }

  async function handlePublish() {
    const didFlush = await flushRemoteSync();
    if (!didFlush) {
      toast.error("MotionRoll couldn't sync the latest draft for publish yet.");
      return;
    }
    window.location.href = `/projects/${projectState.id}/publish`;
  }

  function addOverlay(type: string) {
    if (type === "video") { clearSelection(); setActiveSidebarContext("upload"); return; }
    const overlayId = editorDraft.addOverlay(type, playheadRef.current, frameCount);
    if (overlayId) selectOverlay(overlayId, draftRef.current.overlays);
  }

  const handleOpenSceneAnimation = useCallback(() => {
    setProjectSwitcherOpen(true);
  }, []);

  const handleSetSceneTransitionPreset = useCallback(
    (
      preset: EditorDraft["sceneTransitionPreset"],
    ) => {
      updateDraft((current) => ({
        ...current,
        sceneTransitionPreset: preset,
      }));
    },
    [updateDraft],
  );

  const handleUploadQueued = useCallback(() => {
    void refreshProjectRuntimeState()
      .then((nextProject) => {
        const hasActiveProcessingJob = nextProject.jobs?.some(
          (job) => job.status === "queued" || job.status === "processing",
        );
        if (hasActiveProcessingJob) {
          scheduleProcessingRefresh();
        }
      })
      .catch(() => {
        scheduleProcessingRefresh(1500);
      });
  }, [refreshProjectRuntimeState, scheduleProcessingRefresh]);

  function handleGroupSelectionWrapper() {
    editorDraft.handleGroupSelection(multiSelectedOverlayIds, playheadRef.current, frameCount);
  }

  function handleUngroupSelectionWrapper() {
    if (selectedGroupOverlay && isGroupOverlay(selectedGroupOverlay)) {
      editorDraft.handleUngroupOverlay(selectedGroupOverlay.id, (childId) => {
        if (childId) selectOverlay(childId, draftRef.current.overlays);
        else clearSelection();
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      className="flex h-screen min-h-screen flex-col overflow-hidden"
      style={{ background: "var(--editor-shell)", color: "var(--editor-text)" }}
    >
      <TopBar
        projectId={projectState.id}
        projectName={draft.title}
        projects={projects}
        sectionTitle={draft.sectionTitle}
        frameRangeStart={draft.frameRangeStart}
        frameRangeEnd={draft.frameRangeEnd}
        scrubStrength={draft.scrubStrength}
        sectionHeightVh={draft.sectionHeightVh}
        saveStatus={saveStatus}
        onProjectTitleChange={(value) => updateDraft((cur) => ({ ...cur, title: value }))}
        onSectionTitleChange={(value) => updateDraft((cur) => ({ ...cur, sectionTitle: value }))}
        onFrameRangeChange={(field, value) =>
          updateDraft((cur) => {
            const nextStart = field === "start" ? Math.max(0, value) : cur.frameRangeStart;
            const reqEnd = field === "end" ? Math.max(value, nextStart + 1) : cur.frameRangeEnd;
            const nextEnd = Math.max(reqEnd, nextStart + 1);
            return {
              ...cur,
              frameRangeStart: nextStart,
              frameRangeEnd: nextEnd,
              overlays: scaleSceneRangeOverlays(
                cur.overlays,
                cur.frameRangeStart,
                cur.frameRangeEnd,
                nextStart,
                nextEnd,
                frameCount,
              ),
            };
          })
        }
        onSectionFieldChange={(field, value) =>
          updateDraft((cur) => ({
            ...cur,
            ...(field === "scrubStrength" ? { scrubStrength: value } : { sectionHeightVh: value }),
          }))
        }
        previewMode={previewMode}
        isPlaying={isPlaying}
        onPreviewModeChange={setPreviewMode}
        projectSwitcherOpen={isProjectSwitcherOpen}
        onProjectSwitcherOpenChange={setProjectSwitcherOpen}
        onRetrySync={async () => { await flushRemoteSync(); }}
        onPreview={handlePreview}
        onPublish={handlePublish}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SidebarPanel
          projectId={projectState.id}
          activeContext={activeSidebarContext}
          selectedOverlay={selectedOverlay}
          selectedGroupChildren={selectedGroupChildren}
          canGroupSelection={canGroupSelection}
          canUngroupSelection={canUngroupSelection}
          onContextChange={(context) => {
            if (context === "upload" || context === "ai") clearSelection();
            setActiveSidebarContext(context);
          }}
          onGroupSelection={handleGroupSelectionWrapper}
          onUngroupSelection={handleUngroupSelectionWrapper}
          onSelectGroupChild={(overlayId) => selectOverlay(overlayId, draftRef.current.overlays)}
          onOverlayFieldChange={onOverlayFieldChange}
          onOverlayStyleChange={onOverlayStyleChange}
          onOverlayStyleLiveChange={onOverlayStyleLiveChange}
          onOverlayEnterAnimationChange={onOverlayEnterAnimationChange}
          onOverlayExitAnimationChange={onOverlayExitAnimationChange}
          onAddContent={addOverlay}
          onUploadQueued={handleUploadQueued}
          processingJobs={projectState.jobs}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <EditorErrorBoundary>
              <PreviewErrorBoundary>
                <PreviewStage
                  manifest={editorManifest}
                  mode={previewMode}
                  playback={playback}
                  isPlaying={isPlaying}
                  selectedOverlayId={selectedOverlayId}
                  selectedOverlayIds={multiSelectedOverlayIds}
                  canGroupSelection={canGroupSelection}
                  canUngroupSelection={canUngroupSelection}
                  onModeChange={setPreviewMode}
                  onPlayheadChange={seekPlayhead}
                  onPlayToggle={togglePlay}
                  onSelectOverlay={(overlayId, options) =>
                    selectOverlay(overlayId, draftRef.current.overlays, options)
                  }
                  onOverlayLayoutChange={onOverlayLayoutChange}
                  onInlineTextChange={onInlineTextChange}
                  onOverlayStyleChange={handlePreviewStyleChange}
                  onDuplicateOverlay={(overlayId) => {
                    const rootId = getRootOverlayId(draftRef.current.overlays, overlayId);
                    const dupId = editorDraft.handleDuplicateClip(`layer-${rootId}`, timelineTracks);
                    if (dupId) selectOverlay(dupId, draftRef.current.overlays);
                  }}
                  onDeleteOverlay={(overlayId) => {
                    const rootId = getRootOverlayId(draftRef.current.overlays, overlayId);
                    editorDraft.handleDeleteClip(`layer-${rootId}`, timelineTracks);
                    clearSelection();
                  }}
                  onGroupSelection={handleGroupSelectionWrapper}
                  onUngroupSelection={handleUngroupSelectionWrapper}
                  onMoveSelection={(delta) => editorDraft.handleMoveSelection(delta, multiSelectedOverlayIds)}
                  onDuplicateSelection={() => {
                    const result = editorDraft.handleDuplicateSelection(multiSelectedOverlayIds, selectedOverlayId);
                    if (result.duplicateIds.length > 0) {
                      const activeId = result.duplicateIds[result.duplicateIds.length - 1]!;
                      selectOverlay(activeId, draftRef.current.overlays);
                    }
                  }}
                  onDeleteSelection={() => {
                    editorDraft.handleDeleteSelection(multiSelectedOverlayIds, selectedOverlayId);
                    clearSelection();
                  }}
                />
              </PreviewErrorBoundary>
            </EditorErrorBoundary>
          </div>

          <div
            className="h-[292px] flex-shrink-0 overflow-hidden border-t"
            style={{ borderColor: "var(--editor-border)" }}
          >
            <TimelineErrorBoundary>
              <TimelinePanel
                tracks={timelineTracks}
                selection={selection}
                selectedClipIds={selectedTimelineClipIds}
                playback={playback}
                durationSeconds={durationSeconds}
                isPlaying={isPlaying}
                canUndo={canUndo}
                canRedo={canRedo}
                canGroupSelection={canGroupSelection}
                canUngroupSelection={canUngroupSelection}
                onPlayToggle={togglePlay}
                onUndo={editorDraft.handleUndo}
                onRedo={editorDraft.handleRedo}
                onGroupSelection={handleGroupSelectionWrapper}
                onUngroupSelection={handleUngroupSelectionWrapper}
                onPlayheadChange={seekPlayhead}
                onSelectionChange={(sel, opts) => handleSelectionChange(sel, timelineTracks, opts)}
                onClipTimingChange={(clipId, timing) =>
                  editorDraft.handleClipTimingChange(clipId, timing, frameCount, timelineTracks)
                }
                onCommitClipMove={(move) => editorDraft.handleCommitClipMove(move, timelineTracks)}
                onAddLayer={editorDraft.handleAddLayer}
                onDeleteLayer={editorDraft.handleDeleteLayer}
                onAddAtPlayhead={() => addOverlay("text")}
                onDuplicateClip={(clipId) => {
                  const dupId = editorDraft.handleDuplicateClip(clipId, timelineTracks);
                  if (dupId) selectOverlay(dupId, draftRef.current.overlays);
                }}
                onDeleteClip={(clipId) => {
                  editorDraft.handleDeleteClip(clipId, timelineTracks);
                  clearSelection();
                }}
                onMoveClipToLayer={(clipId, layer) =>
                  editorDraft.handleMoveClipToLayer(clipId, layer, timelineTracks)
                }
                onMoveClipToNewLayer={(clipId) =>
                  editorDraft.handleMoveClipToNewLayer(clipId, timelineTracks)
                }
                onSetClipEnterAnimationType={(clipId, type) =>
                  editorDraft.handleSetClipEnterAnimationType(clipId, type, timelineTracks)
                }
                onSetClipExitAnimationType={(clipId, type) =>
                  editorDraft.handleSetClipExitAnimationType(clipId, type, timelineTracks)
                }
                onOpenSceneAnimation={handleOpenSceneAnimation}
                onSetSceneTransitionPreset={handleSetSceneTransitionPreset}
                onReorderTracks={editorDraft.handleReorderOverlays}
              />
            </TimelineErrorBoundary>
          </div>
        </div>
      </div>
    </main>
  );
}
