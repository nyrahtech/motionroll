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
    transitions?: Array<{
      id?: string;
      scope: "sequence" | "moment";
      phase?: "enter" | "exit";
      fromKey?: string;
      toKey?: string;
      preset: "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve";
      easing?: "linear" | "ease-out" | "ease-in-out" | "back-out" | "expo-out";
      durationMs?: number;
    }>;
  }>;
};

export function parseProjectDraftDocument(input: unknown) {
  const legacyInput = input as {
    sceneTransitionPreset?: ProjectDraftDocument["sceneEnterTransition"]["preset"];
    sceneEnterTransition?: ProjectDraftDocument["sceneEnterTransition"];
    sceneExitTransition?: ProjectDraftDocument["sceneExitTransition"];
  } | null;

  return ProjectDraftDocumentSchema.parse({
    ...legacyInput,
    sceneEnterTransition:
      legacyInput?.sceneEnterTransition ??
      (legacyInput?.sceneTransitionPreset
        ? { preset: legacyInput.sceneTransitionPreset, duration: 0.4 }
        : undefined),
    sceneExitTransition:
      legacyInput?.sceneExitTransition ?? {
        preset: "none",
        duration: 0.4,
      },
  });
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
    overlays.reduce(
      (maxLayer, overlay) =>
        overlay.content.parentGroupId
          ? maxLayer
          : Math.max(maxLayer, overlay.content.layer ?? 0),
      -1,
    ) + 1,
  );

  return ProjectDraftDocumentSchema.parse({
    version: 1,
    title: project.title,
    presetId: project.selectedPreset,
    sectionTitle:
      projectSection?.title ?? manifestSection?.title ?? "Primary cinematic section",
    sceneEnterTransition: {
      preset:
        manifestSection?.transitions.find(
          (transition) => transition.scope === "sequence" && transition.phase === "enter",
        )?.preset ?? "none",
      duration:
        manifestSection?.transitions.find(
          (transition) => transition.scope === "sequence" && transition.phase === "enter",
        )?.duration ?? 0.4,
    },
    sceneExitTransition: {
      preset:
        manifestSection?.transitions.find(
          (transition) => transition.scope === "sequence" && transition.phase === "exit",
        )?.preset ?? "none",
      duration:
        manifestSection?.transitions.find(
          (transition) => transition.scope === "sequence" && transition.phase === "exit",
        )?.duration ?? 0.4,
    },
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
    transitions?: Array<{
      id?: string;
      scope: "sequence" | "moment";
      phase?: "enter" | "exit";
      fromKey?: string;
      toKey?: string;
      preset: "fade" | "crossfade" | "wipe" | "zoom-dissolve" | "blur-dissolve";
      easing?: "linear" | "ease-out" | "ease-in-out" | "back-out" | "expo-out";
      durationMs?: number;
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
      text?: { content: string };
    })?.text ?? {
      content: draft.overlays[0]?.content.text ?? "Primary text block",
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
    transitions: [
      draft.sceneEnterTransition.preset !== "none"
        ? {
            id:
              section?.transitions?.find(
                (transition) => transition.scope === "sequence" && (transition.phase ?? "enter") === "enter",
              )?.id ?? "scene-enter-transition",
            scope: "sequence" as const,
            phase: "enter" as const,
            fromKey: section?.id ?? "draft-section",
            toKey: section?.id ?? "draft-section",
            preset: draft.sceneEnterTransition.preset,
            easing:
              section?.transitions?.find(
                (transition) => transition.scope === "sequence" && (transition.phase ?? "enter") === "enter",
              )?.easing ?? "ease-in-out",
            durationMs: Math.round(draft.sceneEnterTransition.duration * 1000),
          }
        : null,
      draft.sceneExitTransition.preset !== "none"
        ? {
            id:
              section?.transitions?.find(
                (transition) => transition.scope === "sequence" && (transition.phase ?? "enter") === "exit",
              )?.id ?? "scene-exit-transition",
            scope: "sequence" as const,
            phase: "exit" as const,
            fromKey: section?.id ?? "draft-section",
            toKey: section?.id ?? "draft-section",
            preset: draft.sceneExitTransition.preset,
            easing:
              section?.transitions?.find(
                (transition) => transition.scope === "sequence" && (transition.phase ?? "enter") === "exit",
              )?.easing ?? "ease-in-out",
            durationMs: Math.round(draft.sceneExitTransition.duration * 1000),
          }
        : null,
    ].filter((transition): transition is NonNullable<typeof transition> => Boolean(transition)),
  };
}
