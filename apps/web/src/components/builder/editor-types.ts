import type {
  BackgroundMedia,
  BackgroundVideoEndBehavior,
  BackgroundVideoRange,
  OverlayDefinition,
  PresetDefinition,
  PresetId,
  ProjectDraftDocument,
  ProjectManifest,
} from "@motionroll/shared";
import type {
  TimelineTrackModel,
} from "./timeline-model";

export type EditorPaneTab = "assets" | "overlays" | "imports";
export type InspectorTab = "content" | "playback" | "preset";

export type EditorFormValues = {
  title: string;
  sectionTitle: string;
  text: string;
  ctaLabel: string;
  ctaHref: string;
  overlayStart: number;
  overlayEnd: number;
  sectionHeightVh: number;
  scrubStrength: number;
  frameRangeStart: number;
  frameRangeEnd: number;
  presetId: PresetId;
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
      backgroundMedia?: BackgroundMedia;
      backgroundVideoEndBehavior?: BackgroundVideoEndBehavior;
      backgroundVideoRange?: BackgroundVideoRange;
      fallbackBehavior?: {
        mobile: "poster" | "video" | "sequence";
        reducedMotion: "poster" | "video" | "sequence";
      };
      motion?: {
        easing: "linear" | "power2.out" | "power3.out";
        pin: boolean;
        preloadWindow: number;
      };
      text?: { content: string };
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

export type EditorContainerProps = {
  project: EditorProject;
  projects: Array<Pick<EditorProject, "id" | "title" | "slug" | "status" | "lastOpenedAt" | "lastPublishedAt"> & {
    publishTargets?: EditorProject["publishTargets"];
  }>;
  manifest: ProjectManifest;
  preset: PresetDefinition;
};
