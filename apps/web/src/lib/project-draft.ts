import {
  ProjectDraftDocumentSchema,
  type ProjectDraftDocument,
  type ProjectManifest,
} from "@motionroll/shared";

type DraftSourceProject = {
  title: string;
  selectedPreset: ProjectDraftDocument["presetId"];
  sections: Array<{
    id: string;
    title: string;
    commonConfig: {
      sectionHeightVh: number;
      scrubStrength: number;
      frameRange?: { start: number; end: number };
    };
    overlays?: Array<{
      id?: string;
      overlayKey: string;
      sortOrder?: number;
      timing: { start: number; end: number };
      content: Partial<ProjectDraftDocument["overlays"][number]["content"]>;
    }>;
  }>;
};

export function parseProjectDraftDocument(input: unknown) {
  return ProjectDraftDocumentSchema.parse(input);
}

export function buildProjectDraftDocument(
  project: DraftSourceProject,
  manifest: ProjectManifest,
): ProjectDraftDocument {
  const projectSection = project.sections[0];
  const manifestSection = manifest.sections[0];
  const overlays =
    manifestSection?.overlays ??
    (projectSection?.overlays ?? []).map((overlay) => ({
      id: overlay.overlayKey,
      timing: overlay.timing,
      content: overlay.content,
    }));
  const layerCount = Math.max(
    1,
    overlays.reduce((maxLayer, overlay) => Math.max(maxLayer, overlay.content.layer ?? 0), -1) + 1,
  );

  return ProjectDraftDocumentSchema.parse({
    version: 1,
    title: project.title,
    presetId: project.selectedPreset,
    sectionTitle:
      projectSection?.title ?? manifestSection?.title ?? "Primary cinematic section",
    sectionHeightVh:
      projectSection?.commonConfig.sectionHeightVh ??
      manifestSection?.motion.sectionHeightVh ??
      240,
    scrubStrength:
      projectSection?.commonConfig.scrubStrength ??
      manifestSection?.motion.scrubStrength ??
      1,
    frameRangeStart:
      manifestSection?.progressMapping.frameRange.start ??
      projectSection?.commonConfig.frameRange?.start ??
      0,
    frameRangeEnd:
      manifestSection?.progressMapping.frameRange.end ??
      projectSection?.commonConfig.frameRange?.end ??
      180,
    layerCount,
    overlays,
  });
}

export function buildSectionValuesFromDraft<
  TSection extends {
    id: string;
    title: string;
    commonConfig: Record<string, unknown> & {
      sectionHeightVh: number;
      scrubStrength: number;
      frameRange?: { start: number; end: number };
    };
    presetId?: ProjectDraftDocument["presetId"];
    sortOrder?: number;
    presetConfig?: Record<string, unknown>;
    projectId?: string;
    overlays?: Array<{
      id?: string;
      overlayKey: string;
      sortOrder?: number;
      timing: { start: number; end: number };
      content: unknown;
    }>;
  },
>(section: TSection | undefined, draft: ProjectDraftDocument) {
  const existingFallbackBehavior =
    (section?.commonConfig as {
      fallbackBehavior?: {
        mobile: "poster" | "video" | "sequence";
        reducedMotion: "poster" | "video" | "sequence";
      };
    })?.fallbackBehavior ?? {
      mobile: "sequence",
      reducedMotion: "poster",
    };
  const existingMotion =
    (section?.commonConfig as {
      motion?: {
        easing: "linear" | "power2.out" | "power3.out";
        pin: boolean;
        preloadWindow: number;
      };
    })?.motion ?? {
      easing: "power2.out",
      pin: true,
      preloadWindow: 6,
    };
  const existingText =
    (section?.commonConfig as {
      text?: { headline: string; body: string };
    })?.text ?? {
      headline: draft.overlays[0]?.content.headline ?? "Primary headline",
      body: draft.overlays[0]?.content.body ?? "",
    };
  const existingCta =
    (section?.commonConfig as {
      cta?: { label: string; href: string };
    })?.cta ?? {
      label: "",
      href: "",
    };

  return {
    ...(section ?? {}),
    id: section?.id ?? "draft-section",
    projectId: section?.projectId ?? "draft-project",
    title: draft.sectionTitle,
    presetId: section?.presetId ?? draft.presetId,
    sortOrder: section?.sortOrder ?? 0,
    presetConfig: section?.presetConfig ?? {},
    commonConfig: {
      ...(section?.commonConfig ?? {}),
      sectionHeightVh: draft.sectionHeightVh,
      scrubStrength: draft.scrubStrength,
      frameRange: {
        start: draft.frameRangeStart,
        end: draft.frameRangeEnd,
      },
      fallbackBehavior: existingFallbackBehavior,
      motion: existingMotion,
      text: existingText,
      cta: existingCta,
    },
    overlays: draft.overlays.map((overlay) => ({
      id:
        section?.overlays?.find((existingOverlay) => existingOverlay.overlayKey === overlay.id)?.id ??
        overlay.id,
      overlayKey: overlay.id,
      sortOrder:
        section?.overlays?.find((existingOverlay) => existingOverlay.overlayKey === overlay.id)
          ?.sortOrder ??
        draft.overlays.findIndex((draftOverlay) => draftOverlay.id === overlay.id),
      timing: overlay.timing,
      content: overlay.content,
    })),
  };
}
