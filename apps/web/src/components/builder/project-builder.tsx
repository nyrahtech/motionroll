"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  clampProgress,
  normalizeTimingRange,
  type OverlayDefinition,
  type OverlayTransition,
  type PresetId,
} from "@motionroll/shared";
import { SidebarPanel } from "./editor-sidebar";
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
import { UploadPanel } from "./upload-panel";
import { ProviderPanel } from "./provider-panel";
import type { EditorContainerProps } from "./editor-types";
import { getPrimarySourceAsset, getRenderableAssetPreview } from "@/lib/project-assets";

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
  sectionTitle: string;
  sectionHeightVh: number;
  scrubStrength: number;
  frameRangeStart: number;
  frameRangeEnd: number;
  overlays: HydratedOverlayDefinition[];
};

type HistoryState = {
  past: EditorDraft[];
  future: EditorDraft[];
};

function createDefaultOverlay(
  id: string,
  type: "headline" | "subheadline" | "text" | "image" | "logo" | "icon" | "moment",
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
      type:
        type === "headline" || type === "subheadline" || type === "moment"
          ? "text"
          : type,
      eyebrow: type === "text" ? "New content" : undefined,
      headline:
        type === "headline"
          ? "New headline"
          : type === "subheadline"
            ? "Supporting subheadline"
            : type === "moment"
              ? "Moment highlight"
              : type === "image"
                ? "Image callout"
                : type === "logo"
                  ? "Logo mark"
                  : type === "icon"
                    ? "Icon detail"
                    : "Text block",
      body:
        type === "image" || type === "logo" || type === "icon"
          ? "Swap this media and refine its timing."
          : "Edit the copy inline in preview or in the sidebar.",
      mediaUrl,
      align: "start",
      theme: "dark",
      treatment: "default",
      linkHref: undefined,
      layer: 0,
      layout: {
        x: 0.08,
        y: 0.12,
        width: type === "image" ? 360 : type === "logo" ? 220 : type === "icon" ? 180 : 420,
      },
      style: {
        fontFamily: "Inter",
        fontWeight: type === "headline" ? 700 : 600,
        fontSize: type === "headline" ? 46 : type === "subheadline" ? 28 : 34,
        lineHeight: 1.08,
        letterSpacing: 0,
        textAlign: "start",
        color: "#f6f7fb",
        opacity: 1,
        maxWidth: type === "image" ? 360 : 420,
        italic: false,
        textTransform: "none",
        buttonLike: false,
      },
      background: {
        enabled: false,
        mode: "transparent",
        color: "#0d1016",
        opacity: 0.82,
        radius: 14,
        paddingX: 18,
        paddingY: 14,
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
    },
  };
}

function hydrateOverlay(overlay: OverlayDefinition): HydratedOverlayDefinition {
  return {
    ...overlay,
    content: {
      type: overlay.content.type ?? "text",
      eyebrow: overlay.content.eyebrow,
      headline: overlay.content.headline,
      body: overlay.content.body,
      cta: overlay.content.cta,
      align: overlay.content.align ?? "start",
      theme: overlay.content.theme ?? "light",
      treatment: overlay.content.treatment ?? "default",
      mediaUrl: overlay.content.mediaUrl,
      linkHref: overlay.content.linkHref,
      textHtml: overlay.content.textHtml,
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
        textTransform: overlay.content.style?.textTransform ?? "none",
        buttonLike: overlay.content.style?.buttonLike ?? false,
      },
      background: {
        enabled: overlay.content.background?.enabled ?? false,
        mode: overlay.content.background?.mode ?? "transparent",
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
    },
  };
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
    sectionTitle: section?.title ?? manifestSection?.title ?? "Primary cinematic section",
    sectionHeightVh: section?.commonConfig.sectionHeightVh ?? manifestSection?.motion.sectionHeightVh ?? 240,
    scrubStrength: section?.commonConfig.scrubStrength ?? manifestSection?.motion.scrubStrength ?? 1,
    frameRangeStart: manifestSection?.progressMapping.frameRange.start ?? 0,
    frameRangeEnd: manifestSection?.progressMapping.frameRange.end ?? 180,
    overlays: (manifestSection?.overlays ?? []).map(hydrateOverlay),
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
        title: draft.sectionTitle,
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
          sectionHeightVh: draft.sectionHeightVh,
          scrubStrength: draft.scrubStrength,
        },
      },
    ],
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

export function ProjectEditor({ project, projects, manifest }: EditorContainerProps) {
  const [projectState, setProjectState] = useState(project);
  const [manifestState, setManifestState] = useState(manifest);
  const [draft, setDraft] = useState(() => createDraft(project, manifest));
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0.24);
  const [selection, setSelection] = useState<TimelineSelection>(
    manifest.sections[0]?.overlays[0]
      ? { clipId: `overlay-${manifest.sections[0].overlays[0].id}`, trackType: "overlay" }
      : { clipId: "section-range", trackType: "section" },
  );
  const [showImportTools, setShowImportTools] = useState(false);
  const playbackRafRef = useRef<number | null>(null);
  const playbackLastTickRef = useRef<number | null>(null);
  const playheadRef = useRef(playhead);
  const draftRef = useRef(draft);
  const initializedRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const editorManifest = useMemo(() => buildDraftManifest(manifestState, draft), [draft, manifestState]);
  const frameCount = editorManifest.sections[0]?.frameCount ?? 0;
  const durationSeconds = useMemo(
    () => getDurationSeconds(projectState, frameCount),
    [frameCount, projectState],
  );
  const timelineTracks = useMemo(
    () => deriveTimelineTracks(editorManifest, durationSeconds),
    [durationSeconds, editorManifest],
  );
  const selectedClip = useMemo(
    () => findSelectedClip(timelineTracks, selection),
    [selection, timelineTracks],
  );
  const selectedOverlayId = selectedClip?.metadata?.overlayId;
  const selectedOverlay = draft.overlays.find((overlay) => overlay.id === selectedOverlayId);
  const publishTarget = projectState.publishTargets?.find((target) => target.targetType === "hosted_embed");
  const defaultMediaUrl = useMemo(() => {
    const poster = projectState.assets.find((asset) => asset.kind === "poster");
    if (poster) {
      return getRenderableAssetPreview(poster, projectState.assets);
    }
    return projectState.assets[0]
      ? getRenderableAssetPreview(projectState.assets[0], projectState.assets)
      : undefined;
  }, [projectState.assets]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

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

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    if (saveState !== "dirty") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistDraft();
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [draft, saveState]);

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
        void persistDraft();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setSaveState("dirty");
  }

  function updateDraft(
    transform: (current: EditorDraft) => EditorDraft,
    recordHistory = true,
  ) {
    applyDraft(transform(structuredClone(draftRef.current)), recordHistory);
  }

  function restoreFromServer(
    nextProject: typeof projectState,
    nextManifest: typeof manifestState,
  ) {
    const nextDraft = createDraft(nextProject, nextManifest);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setProjectState(nextProject);
    setManifestState(nextManifest);
    setHistory({ past: [], future: [] });
    setSaveState("saved");
  }

  async function persistDraft() {
    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }

    setSaveState("saving");
    const payload = structuredClone(draftRef.current);

    const savePromise = fetch(`/api/projects/${projectState.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: payload.title,
        presetId: payload.presetId,
        sectionTitle: payload.sectionTitle,
        sectionHeightVh: payload.sectionHeightVh,
        scrubStrength: payload.scrubStrength,
        frameRange: {
          start: payload.frameRangeStart,
          end: payload.frameRangeEnd,
        },
        overlays: payload.overlays.map(sanitizeOverlayForSave),
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          setSaveState("error");
          return;
        }

        const data = (await response.json()) as {
          manifest: typeof manifestState;
          project: typeof projectState | null;
        };

        if (data.project) {
          restoreFromServer(data.project, data.manifest);
          startTransition(() => {
            if (selectedOverlayId) {
              setSelection({ clipId: `overlay-${selectedOverlayId}`, trackType: "overlay" });
            }
          });
        }
      })
      .catch(() => {
        setSaveState("error");
      })
      .finally(() => {
        savePromiseRef.current = null;
      });

    savePromiseRef.current = savePromise;
    return savePromise;
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
      setSaveState("dirty");
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
      setSaveState("dirty");
      return {
        past: [...historyState.past, current].slice(-40),
        future,
      };
    });
  }

  function handleSelectionChange(nextSelection: TimelineSelection) {
    setSelection(nextSelection);
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

  function selectOverlay(overlayId: string, trackType: "overlay" | "moment" = "overlay") {
    setSelection({ clipId: `${trackType}-${overlayId}`, trackType });
  }

  function addOverlay(type: string) {
    if (type === "video") {
      setShowImportTools((current) => !current);
      return;
    }

    const contentType =
      type === "image" || type === "logo" || type === "icon"
        ? type
        : "text";
    const overlayId = buildOverlayId(type);
    const overlay = createDefaultOverlay(
      overlayId,
      contentType,
      playheadRef.current,
      contentType === "text" ? undefined : defaultMediaUrl,
    );
    if (type === "headline") {
      overlay.content.headline = "A cleaner editor-first headline";
      overlay.content.body = "Use the floating text tools or the sidebar to tune the typography.";
      overlay.content.style = {
        ...overlay.content.style,
        fontSize: 48,
        fontWeight: 700,
      };
    }
    if (type === "subheadline") {
      overlay.content.eyebrow = "Supporting";
      overlay.content.headline = "A smaller supporting beat";
      overlay.content.style = {
        ...overlay.content.style,
        fontSize: 24,
        fontWeight: 500,
      };
    }
    if (type === "moment") {
      overlay.content.eyebrow = "Moment";
      overlay.content.headline = "Add a larger story beat";
      overlay.content.transition = {
        preset: "wipe",
        easing: "ease-in-out",
        duration: 0.42,
      } satisfies OverlayTransition;
    }

    updateDraft((current) => ({
      ...current,
      overlays: [...current.overlays, overlay],
    }));
    selectOverlay(overlayId);
  }

  function handleDuplicateClip(clipId: string) {
    const clip = findClipById(timelineTracks, clipId);
    const overlayId = clip?.metadata?.overlayId;
    if (!overlayId) {
      return;
    }

    const duplicateId = buildOverlayId("copy");

    updateDraft((current) => {
      const source = current.overlays.find((overlay) => overlay.id === overlayId);
      if (!source) {
        return current;
      }

      const duplicate = hydrateOverlay({
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
          headline: `${source.content.headline} Copy`,
        },
      });

      return {
        ...current,
        overlays: [
          ...current.overlays.flatMap((overlay) =>
            overlay.id === overlayId ? [overlay, duplicate] : [overlay],
          ),
        ],
      };
    });
    selectOverlay(duplicateId);
  }

  function handleDeleteClip(clipId: string) {
    const clip = findClipById(timelineTracks, clipId);
    const overlayId = clip?.metadata?.overlayId;
    if (!overlayId) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      overlays: current.overlays.filter((overlay) => overlay.id !== overlayId),
    }));
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
    const clipId = `overlay-${overlayId}`;
    handleDuplicateClip(clipId);
  }

  function handleDeleteOverlay(overlayId: string) {
    const clipId = `overlay-${overlayId}`;
    handleDeleteClip(clipId);
  }

  function handleOverlayStyleQuickChange(overlayId: string, changes: Record<string, unknown>) {
    updateDraft((current) => ({
      ...current,
      overlays: current.overlays.map((overlay) =>
        overlay.id === overlayId
          ? {
              ...overlay,
              content: {
                ...overlay.content,
                style: {
                  ...overlay.content.style,
                  ...(changes.fontFamily !== undefined ? { fontFamily: String(changes.fontFamily) } : {}),
                  ...(changes.fontWeight !== undefined ? { fontWeight: Number(changes.fontWeight) } : {}),
                  ...(changes.fontSize !== undefined ? { fontSize: Number(changes.fontSize) } : {}),
                  ...(changes.color !== undefined ? { color: String(changes.color) } : {}),
                  ...(changes.italic !== undefined ? { italic: Boolean(changes.italic) } : {}),
                  ...(changes.textAlign !== undefined ? { textAlign: changes.textAlign as "start" | "center" | "end" } : {}),
                },
              },
            }
          : overlay,
      ),
    }));
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
                transition: preset
                  ? {
                      ...(overlay.content.transition ?? { preset: "fade", easing: "ease-in-out", duration: 0.4 }),
                      preset,
                    }
                  : undefined,
              },
            }
          : overlay,
      ),
    }));
  }

  function handleMoveClipToTrack(clipId: string, nextTrack: "overlay" | "moment") {
    const clip = findClipById(timelineTracks, clipId);
    const overlayId = clip?.metadata?.overlayId;
    if (!overlayId) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      overlays: current.overlays.map((overlay) => {
        if (overlay.id !== overlayId) {
          return overlay;
        }

        const eyebrow = overlay.content.eyebrow?.trim();
        return {
          ...overlay,
          content: {
            ...overlay.content,
            eyebrow:
              nextTrack === "moment"
                ? eyebrow && eyebrow.length > 0
                  ? eyebrow
                  : "Moment"
                : eyebrow?.toLowerCase() === "moment"
                  ? undefined
                  : overlay.content.eyebrow,
          },
        };
      }),
    }));
    setSelection({ clipId: `${nextTrack}-${overlayId}`, trackType: nextTrack });
  }

  function handleReorderOverlays(fromIndex: number, toIndex: number) {
    updateDraft((current) => {
      const next = [...current.overlays];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...current, overlays: next };
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
        saveState={saveState}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPreview={() => {
          const href = publishTarget ? `/embed/${publishTarget.slug}` : `/projects/${projectState.id}/publish`;
          window.open(href, "_blank", "noopener,noreferrer");
        }}
        onPublish={() => {
          window.location.href = `/projects/${projectState.id}/publish`;
        }}
      />

      {/* Main area: left sidebar | canvas+timeline */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>

        {/* Left sidebar */}
        <SidebarPanel
          overlays={draft.overlays}
          selectedOverlay={selectedOverlay}
          selectedClip={selectedClip}
          selection={selection}
          projectTitle={draft.title}
          sectionTitle={draft.sectionTitle}
          frameRangeStart={draft.frameRangeStart}
          frameRangeEnd={draft.frameRangeEnd}
          scrubStrength={draft.scrubStrength}
          sectionHeightVh={draft.sectionHeightVh}
          onProjectTitleChange={(value) => updateDraft((current) => ({ ...current, title: value }))}
          onSectionTitleChange={(value) =>
            updateDraft((current) => ({ ...current, sectionTitle: value }))
          }
          onFrameRangeChange={(field, value) =>
            updateDraft((current) => ({
              ...current,
              frameRangeStart: field === "start" ? Math.max(0, value) : current.frameRangeStart,
              frameRangeEnd:
                field === "end" ? Math.max(value, current.frameRangeStart + 1) : current.frameRangeEnd,
            }))
          }
          onSectionFieldChange={(field, value) =>
            updateDraft((current) => ({ ...current, [field]: value }))
          }
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
                  eyebrow: field === "eyebrow" ? value : hydrated.content.eyebrow,
                  headline: field === "headline" ? value : hydrated.content.headline,
                  body: field === "body" ? value : hydrated.content.body,
                  mediaUrl: field === "mediaUrl" ? value : hydrated.content.mediaUrl,
                  linkHref: field === "linkHref" ? value : hydrated.content.linkHref,
                  align:
                    field === "align"
                      ? (value as OverlayDefinition["content"]["align"])
                      : hydrated.content.align,
                  theme:
                    field === "theme"
                      ? (value as OverlayDefinition["content"]["theme"])
                      : hydrated.content.theme,
                  type:
                    field === "type"
                      ? (value as HydratedOverlayDefinition["content"]["type"])
                      : hydrated.content.type,
                  cta:
                    field === "ctaLabel" || field === "ctaHref"
                      ? {
                          label: field === "ctaLabel" ? value : hydrated.content.cta?.label ?? "",
                          href: field === "ctaHref" ? value : hydrated.content.cta?.href ?? "",
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
                mode: field === "backgroundMode" ? (value as "transparent" | "solid") : hydrated.content.background.mode,
                color: field === "backgroundColor" ? String(value) : hydrated.content.background.color,
                opacity: field === "backgroundOpacity" ? Number(value) : hydrated.content.background.opacity,
                radius: field === "backgroundRadius" ? Number(value) : hydrated.content.background.radius,
                paddingX: field === "backgroundPaddingX" ? Number(value) : hydrated.content.background.paddingX,
                paddingY: field === "backgroundPaddingY" ? Number(value) : hydrated.content.background.paddingY,
                borderColor: field === "backgroundBorderColor" ? String(value) : hydrated.content.background.borderColor,
                borderOpacity: field === "backgroundBorderOpacity" ? Number(value) : hydrated.content.background.borderOpacity,
              };
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
                  background: nextBackground,
                  layout:
                    field === "width" || field === "height" || field === "x" || field === "y"
                      ? { ...hydrated.content.layout, [field]: Number(value) }
                      : hydrated.content.layout,
                  layer: field === "layer" ? Number(value) : hydrated.content.layer,
                },
              };
            });
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
          onSelectOverlay={(overlayId) => selectOverlay(overlayId)}
          onReorderOverlays={handleReorderOverlays}
          onAddContent={addOverlay}
          extraAddContent={
            showImportTools ? (
              <div className="space-y-3">
                <UploadPanel projectId={projectState.id} />
                <ProviderPanel projectId={projectState.id} />
              </div>
            ) : null
          }
        />

        {/* Canvas + Timeline column */}
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 min-h-0">
            <PreviewStage
              manifest={editorManifest}
              mode={previewMode}
              reducedMotion={reducedMotion}
              playheadProgress={playhead}
              durationSeconds={durationSeconds}
              isPlaying={isPlaying}
              selectedOverlayId={selectedOverlayId}
              onModeChange={setPreviewMode}
              onReducedMotionChange={setReducedMotion}
              onPlayheadChange={(value) => {
                const nextPlayhead = clampProgress(value);
                setIsPlaying(false);
                playheadRef.current = nextPlayhead;
                setPlayhead(nextPlayhead);
              }}
              onPlayToggle={() => setIsPlaying((current) => !current)}
              onSelectOverlay={(overlayId) => selectOverlay(overlayId)}
              onOverlayLayoutChange={(overlayId, layout) => {
                updateDraft((current) => ({
                  ...current,
                  overlays: current.overlays.map((overlay) =>
                    overlay.id === overlayId
                      ? hydrateOverlay({
                          ...overlay,
                          content: {
                            ...overlay.content,
                            layout: {
                              x: overlay.content.layout?.x ?? 0.08,
                              y: overlay.content.layout?.y ?? 0.12,
                              width: overlay.content.layout?.width ?? 420,
                              height: overlay.content.layout?.height,
                              ...layout,
                            },
                          },
                        })
                      : overlay,
                  ),
                }));
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
                            textHtml: {
                              ...overlay.content.textHtml,
                              [field]: htmlValue || undefined,
                            },
                          },
                        }
                      : overlay,
                  ),
                }));
              }}
              onOverlayStyleChange={handleOverlayStyleQuickChange}
              onDuplicateOverlay={handleDuplicateOverlay}
              onDeleteOverlay={handleDeleteOverlay}
            />
          </div>

          {/* Timeline */}
          <div
            className="h-72 flex-shrink-0 border-t"
            style={{ borderColor: "var(--editor-border)" }}
          >
            <TimelinePanel
              tracks={timelineTracks}
              selection={selection}
              playhead={playhead}
              durationSeconds={durationSeconds}
              isPlaying={isPlaying}
              onPlayToggle={() => setIsPlaying((current) => !current)}
              onPlayheadChange={(value) => {
                const nextPlayhead = clampProgress(value);
                setIsPlaying(false);
                playheadRef.current = nextPlayhead;
                setPlayhead(nextPlayhead);
              }}
              onSelectionChange={handleSelectionChange}
              onClipTimingChange={handleClipTimingChange}
              onAddAtPlayhead={() => addOverlay("text")}
              onDuplicateClip={handleDuplicateClip}
              onDeleteClip={handleDeleteClip}
              onMoveClipToTrack={handleMoveClipToTrack}
              onSetClipTransitionPreset={handleSetClipTransitionPreset}
            />
          </div>
        </div>

      </div>
    </main>
  );
}
