import type {
  OverlayDefinition,
  PresetId,
} from "@motionroll/shared";

export type HydratedOverlayDefinition = OverlayDefinition & {
  content: OverlayDefinition["content"] & {
    type: NonNullable<OverlayDefinition["content"]["type"]>;
    layout: NonNullable<OverlayDefinition["content"]["layout"]>;
    style: NonNullable<OverlayDefinition["content"]["style"]>;
    background: NonNullable<OverlayDefinition["content"]["background"]>;
    animation: NonNullable<OverlayDefinition["content"]["animation"]>;
    transition: NonNullable<OverlayDefinition["content"]["transition"]>;
  };
};

/**
 * The in-editor representation of a project draft.
 *
 * Field names deliberately match `ProjectDraftDocument` (the wire/DB contract)
 * so that serialization is a straight copy — no renaming translation layer.
 */
export type EditorDraft = {
  title: string;
  presetId: PresetId;
  /** Maps directly to ProjectDraftDocument.sectionTitle */
  sectionTitle: string;
  /** Maps directly to ProjectDraftDocument.sectionHeightVh */
  sectionHeightVh: number;
  scrubStrength: number;
  frameRangeStart: number;
  frameRangeEnd: number;
  layerCount: number;
  overlays: HydratedOverlayDefinition[];
};
