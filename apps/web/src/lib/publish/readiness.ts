import {
  getPresetFallbackPolicy,
  resolveFallbackStrategy,
  type ReadinessCheck,
} from "@motionroll/shared";

type ProjectSnapshot = {
  selectedPreset: Parameters<typeof getPresetFallbackPolicy>[0];
  sections: Array<{
    title: string;
    commonConfig: {
      frameRange: {
        start: number;
        end: number;
      };
      fallbackBehavior: {
        mobile: "poster" | "video" | "sequence";
        reducedMotion: "poster" | "video" | "sequence";
      };
      text: {
        content: string;
      };
    };
  }>;
  assets: Array<{
    kind: string;
    sourceOrigin: string | null;
  }>;
  jobs: Array<{
    status: string;
    failureReason: string | null;
  }>;
  failureReason: string | null;
};

export function buildPublishReadinessChecks(project: ProjectSnapshot): ReadinessCheck[] {
  const primarySection = project.sections[0];
  const policy = getPresetFallbackPolicy(project.selectedPreset);
  const hasFrameSequence = project.assets.some((asset) => asset.kind === "frame_sequence");
  const hasFrames = hasFrameSequence || project.assets.some((asset) => asset.kind === "frame");
  const hasPoster = project.assets.some((asset) => asset.kind === "poster");
  const hasFallbackVideo = project.assets.some((asset) => asset.kind === "fallback_video");
  const hasBackgroundVideo = Boolean((primarySection?.commonConfig as { backgroundMedia?: { url?: string } })?.backgroundMedia?.url);
  const hasSceneMedia = hasFrames || hasPoster || hasFallbackVideo || hasBackgroundVideo;
  const mobileFallback = primarySection
    ? resolveFallbackStrategy({
        requestedBehavior: primarySection.commonConfig.fallbackBehavior.mobile,
        hasFrames,
        hasPoster,
        hasFallbackVideo,
        allowFirstFrameFallback: policy.allowFirstFrameFallback,
      })
    : "disabled";
  const reducedMotionFallback = primarySection
    ? resolveFallbackStrategy({
        requestedBehavior: primarySection.commonConfig.fallbackBehavior.reducedMotion,
        hasFrames,
        hasPoster,
        hasFallbackVideo,
        allowFirstFrameFallback: policy.allowFirstFrameFallback,
      })
    : "disabled";

  const checks: ReadinessCheck[] = [
    {
      id: "section-config",
      label: "Section configured",
      status: primarySection ? "ready" : "blocked",
      message: primarySection
        ? `Section "${primarySection.title}" is present.`
        : "Add the primary cinematic section before publishing.",
    },
    {
      id: "editor-copy",
      label: "Section text",
      status:
        primarySection?.commonConfig.text.content
          ? "ready"
          : "blocked",
      message:
        primarySection?.commonConfig.text.content
          ? "Section text is set."
          : "Add at least one text block so the overlay content is publication-ready.",
    },
    {
      id: "scene-media",
      label: "Scene media",
      status: hasSceneMedia ? "ready" : "blocked",
      message: hasBackgroundVideo
        ? "Scene background video is attached."
        : hasFrames
          ? "Derived frames are available for sequence playback."
          : "Attach scene media or process frames before publish.",
    },
    {
      id: "poster",
      label: "Poster fallback",
      status: hasPoster
        ? "ready"
        : hasFrames && policy.allowFirstFrameFallback
          ? "warning"
          : policy.posterRequirement === "preferred"
            ? "warning"
            : "blocked",
      message: hasPoster
        ? "Poster fallback exists."
        : hasFrames && policy.allowFirstFrameFallback
          ? "Poster is missing, but the first frame can act as a fallback."
          : policy.posterRequirement === "preferred"
            ? "Poster is recommended for cleaner loading and reduced-motion behavior."
            : "A poster image is required for reduced-motion and loading states.",
    },
    {
      id: "fallback-video",
      label: "Fallback video",
      status: hasFallbackVideo
        ? "ready"
        : policy.videoRequirement === "preferred" &&
            (mobileFallback === "poster" || reducedMotionFallback === "poster")
          ? "warning"
          : "ready",
      message: hasFallbackVideo
        ? "Fallback video exists for mobile-safe playback."
        : policy.videoRequirement === "preferred" &&
            (mobileFallback === "poster" || reducedMotionFallback === "poster")
          ? "Fallback video is still recommended for smoother mobile-safe playback, but publish can continue with poster or first-frame fallback."
          : "Poster or first-frame fallback is sufficient for this preset.",
    },
    {
      id: "processing",
      label: "Processing status",
      status: project.jobs.some((job) => job.status === "failed")
        ? "blocked"
        : project.jobs.some((job) => job.status === "completed")
          ? "ready"
          : "warning",
      message: project.jobs.some((job) => job.status === "failed")
        ? project.jobs.find((job) => job.failureReason)?.failureReason ?? "A processing job failed."
        : project.jobs.some((job) => job.status === "completed")
          ? "Latest processing job completed."
          : "No completed processing jobs yet.",
    },
    {
      id: "frame-range",
      label: "Frame mapping",
      status:
        primarySection &&
        primarySection.commonConfig.frameRange.end > primarySection.commonConfig.frameRange.start
          ? "ready"
          : "blocked",
      message:
        primarySection &&
        primarySection.commonConfig.frameRange.end > primarySection.commonConfig.frameRange.start
          ? "Frame range is valid."
          : "The frame range must span at least two frames.",
    },
    {
      id: "fallback-strategy",
      label: "Resolved fallback",
      status:
        mobileFallback === "disabled" || reducedMotionFallback === "disabled"
          ? "blocked"
          : "ready",
      message:
        mobileFallback === "disabled" || reducedMotionFallback === "disabled"
          ? "The runtime does not have enough media to resolve a safe fallback strategy."
          : `Mobile uses ${mobileFallback}; reduced motion uses ${reducedMotionFallback}.`,
    },
  ];

  if (project.failureReason) {
    checks.push({
      id: "project-error",
      label: "Project health",
      status: "blocked",
      message: project.failureReason,
    });
  }

  return checks;
}

export function summarizePublishReadiness(checks: ReadinessCheck[]) {
  const blocked = checks.filter((check) => check.status === "blocked");
  const warnings = checks.filter((check) => check.status === "warning");

  return {
    ready: blocked.length === 0,
    blockedCount: blocked.length,
    warningCount: warnings.length,
    checks,
    reasons: blocked.map((check) => check.message),
  };
}
