import {
  ProjectDraftDocumentSchema,
  type ProjectDraftDocument,
  type ProjectManifest,
} from "@motionroll/shared";

type DraftSourceProject = {
  title: string;
  selectedPreset: ProjectDraftDocument["presetId"];
};

const DEFAULT_BOOKMARK_ID = "bookmark-root";
const DEFAULT_CANVAS_ID = "canvas-root";
const DEFAULT_BOOKMARK_TITLE = "Canvas";

export class UnsupportedLegacyProjectDraftError extends Error {
  code = "unsupported_version" as const;

  constructor(message = "Scene-based project drafts are unsupported after the single-canvas refactor.") {
    super(message);
    this.name = "UnsupportedLegacyProjectDraftError";
  }
}

export function createProjectDraftDocument(input: {
  title: string;
  presetId: ProjectDraftDocument["presetId"];
  scrollHeightVh: number;
  scrubStrength: number;
  frameRange: { start: number; end: number };
  backgroundColor?: string;
  bookmarkTitle?: string;
  layers?: ProjectDraftDocument["layers"];
}): ProjectDraftDocument {
  return {
    version: 3 as const,
    title: input.title,
    presetId: input.presetId,
    canvas: {
      id: DEFAULT_CANVAS_ID,
      scrollHeightVh: input.scrollHeightVh,
      scrubStrength: input.scrubStrength,
      frameRange: input.frameRange,
      backgroundColor: input.backgroundColor,
    },
    bookmarks: [
      {
        id: DEFAULT_BOOKMARK_ID,
        title: input.bookmarkTitle?.trim() || DEFAULT_BOOKMARK_TITLE,
        position: 0,
      },
    ],
    layers: input.layers ?? [],
  } satisfies ProjectDraftDocument;
}

export function serializeProjectDraftDocument(
  draft: ProjectDraftDocument,
): ProjectDraftDocument {
  return {
    version: 3,
    title: draft.title,
    presetId: draft.presetId,
    canvas: draft.canvas,
    bookmarks: draft.bookmarks,
    layers: draft.layers,
  };
}

export function parseProjectDraftDocument(input: unknown): ProjectDraftDocument {
  const maybeDraft = input as ({ version?: number; scenes?: unknown[] } & Record<string, unknown>) | null;

  if (typeof maybeDraft?.version === "number" && maybeDraft.version < 3) {
    throw new UnsupportedLegacyProjectDraftError();
  }

  if (Array.isArray(maybeDraft?.scenes) && !("canvas" in (maybeDraft ?? {}))) {
    throw new UnsupportedLegacyProjectDraftError();
  }

  return ProjectDraftDocumentSchema.parse(maybeDraft);
}

export function buildProjectDraftDocument(
  project: DraftSourceProject,
  manifest: ProjectManifest,
): ProjectDraftDocument {
  return {
    version: 3,
    title: project.title,
    presetId: project.selectedPreset,
    canvas: {
      id: manifest.canvas.id ?? DEFAULT_CANVAS_ID,
      scrollHeightVh: manifest.canvas.motion.sectionHeightVh,
      scrubStrength: manifest.canvas.motion.scrubStrength,
      frameRange: manifest.canvas.progressMapping.frameRange,
      backgroundColor: manifest.canvas.backgroundColor,
      backgroundTrack: manifest.canvas.backgroundTrack,
    },
    bookmarks:
      manifest.bookmarks.length > 0
        ? manifest.bookmarks
        : [
            {
              id: DEFAULT_BOOKMARK_ID,
              title: DEFAULT_BOOKMARK_TITLE,
              position: 0,
            },
          ],
    layers: manifest.layers,
  };
}
