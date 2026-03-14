import type { PresetDefinition, PresetId, ProjectManifest } from "@motionroll/shared";
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
  latestPublishVersion?: number;
  sections: Array<{
    id: string;
    title: string;
    overlays?: Array<{
      id: string;
      overlayKey: string;
      timing: { start: number; end: number };
      content: { eyebrow?: string; headline: string; body: string };
    }>;
    commonConfig: {
      sectionHeightVh: number;
      scrubStrength: number;
      text: { headline: string; body: string };
      cta: { label: string; href: string };
    };
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
