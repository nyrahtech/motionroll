/**
 * editor-draft-utils.ts
 *
 * Canonical conversion functions between the editor's in-memory EditorDraft
 * and the wire/DB format ProjectDraftDocument.
 *
 * These live here — not in project-builder or useEditorPersistence — so both
 * consumers import from a single source of truth.
 */
import type { ProjectDraftDocument } from "@motionroll/shared";
import type { EditorDraft, HydratedOverlayDefinition } from "./editor-draft-types";
import {
  hydrateOverlay,
  sanitizeOverlayForSave,
  getRequiredLayerCount,
} from "./editor-overlay-utils";

/**
 * Converts a ProjectDraftDocument (wire/DB format) into an EditorDraft
 * (in-memory editor format). Hydrates overlays with defaults.
 */
export function documentToEditorDraft(document: ProjectDraftDocument): EditorDraft {
  return {
    title: document.title,
    presetId: document.presetId,
    sectionTitle: document.sectionTitle,
    sectionHeightVh: document.sectionHeightVh,
    scrubStrength: document.scrubStrength,
    frameRangeStart: document.frameRangeStart,
    frameRangeEnd: document.frameRangeEnd,
    layerCount: getRequiredLayerCount(document.overlays, document.layerCount),
    overlays: document.overlays.map((o, i) => {
      const hydrated = hydrateOverlay(o);
      return {
        ...hydrated,
        content: {
          ...hydrated.content,
          layer: Math.max(0, hydrated.content.layer ?? Math.max(document.overlays.length - i - 1, 0)),
        },
      } as HydratedOverlayDefinition;
    }),
  };
}

/**
 * Converts an EditorDraft (in-memory editor format) into a ProjectDraftDocument
 * (wire/DB format). Sanitizes overlays for storage.
 */
export function editorDraftToDocument(draft: EditorDraft): ProjectDraftDocument {
  return {
    version: 1,
    title: draft.title,
    presetId: draft.presetId,
    sectionTitle: draft.sectionTitle,
    sectionHeightVh: draft.sectionHeightVh,
    scrubStrength: draft.scrubStrength,
    frameRangeStart: draft.frameRangeStart,
    frameRangeEnd: draft.frameRangeEnd,
    layerCount: getRequiredLayerCount(draft.overlays, draft.layerCount),
    overlays: draft.overlays.map(sanitizeOverlayForSave),
  };
}
