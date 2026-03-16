import type {
  OverlayDefinition,
  PresetDefinition,
  PresetId,
  ProjectDraftDocument,
  ProjectManifest,
} from "@motionroll/shared";
import type {
  TimelineClipModel,
  TimelineDraftState,
  TimelineSelection,
  TimelineTrackModel,
} from "./timeline-model";

export type EditorFormValues = {
  title: string;
  presetId: PresetId;
  sectionTitle: string;
  sectionHeightVh: number;
  scrubStrength: number;
  frameRangeStart: number;
  frameRangeEnd: number;
  selectedOverlayId?: string;
  overlayStart?: number;
  overlayEnd?: number;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

export type EditorProject = {
  id: string;
  title: string;
  status: string;
  slug: string;
  selectedPreset: PresetId;
  lastOpenedAt?: Date | null;
  lastSavedAt?: Date | null;
  lastPublishedAt?: Date | null;
  updatedAt?: Date | string | null;
  latestPublishVersion?: number;
  draftRevision?: number;
  draftJson?: ProjectDraftDocument | null;
  sections: Array<{
    id: string;
    projectId?: string;
    title: string;
    sortOrder?: number;
    presetId?: PresetId;
    presetConfig?: Record<string, unknown>;
    overlays?: Array<{
      id: string;
      overlayKey: string;
      sortOrder?: number;
      timing: { start: number; end: number };
      content: OverlayDefinition["content"];
    }>;
    commonConfig: {
      sectionHeightVh: number;
      scrubStrength: number;
      frameRange?: { start: number; end: number };
      fallbackBehavior?: {
        mobile: "poster" | "video" | "sequence";
        reducedMotion: "poster" | "video" | "sequence";
      };
      motion?: {
        easing: "linear" | "power2.out" | "power3.out";
        pin: boolean;
        preloadWindow: number;
      };
      text?: { headline: string; body: string };
      cta?: { label: string; href: string };
    } & Record<string, unknown>;
  }>;
  assets: Array<{
    id: string;
    kind: string;
    storageKey: string;
    publicUrl: string;
    isPrimary?: boolean;
    sourceType?: string | null;
    sourceOrigin?: string | null;
    metadata?: unknown;
  }>;
  jobs: Array<{
    id: string;
    status: string;
    failureReason: string | null;
  }>;
  publishTargets?: Array<{
    targetType: string;
    slug: string;
    isReady: boolean;
    version: number;
    publishedAt: Date | null;
  }>;
};

export type EditorPaneTab = "assets" | "overlays" | "imports";
export type InspectorTab = "content" | "playback" | "preset";

export type EditorTimelineState = {
  tracks: TimelineTrackModel[];
  selection: TimelineSelection;
  draft: TimelineDraftState;
  activeClip?: TimelineClipModel;
};

export type EditorContainerProps = {
  project: EditorProject;
  projects: Array<Pick<EditorProject, "id" | "title" | "slug" | "status" | "lastOpenedAt" | "lastPublishedAt"> & {
    publishTargets?: EditorProject["publishTargets"];
  }>;
  manifest: ProjectManifest;
  preset: PresetDefinition;
};
