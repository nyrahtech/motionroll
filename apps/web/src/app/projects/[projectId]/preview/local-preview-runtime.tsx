"use client";

import { useEffect, useState } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import { StandaloneRuntime } from "@/components/runtime/standalone-runtime";
import { readLocalPreviewSession } from "@/lib/local-preview-session";

export function LocalPreviewRuntime({
  projectId,
  fallbackManifest,
  mode,
  forceSequence,
  localPreviewSessionId,
}: {
  projectId: string;
  fallbackManifest: ProjectManifest;
  mode: "desktop" | "mobile";
  forceSequence: boolean;
  localPreviewSessionId?: string;
}) {
  const [resolvedManifest, setResolvedManifest] = useState<ProjectManifest | null>(
    localPreviewSessionId ? null : fallbackManifest,
  );

  useEffect(() => {
    if (!localPreviewSessionId) {
      setResolvedManifest(fallbackManifest);
      return;
    }

    const localManifest = readLocalPreviewSession(projectId, localPreviewSessionId);
    setResolvedManifest(localManifest ?? fallbackManifest);
  }, [fallbackManifest, localPreviewSessionId, projectId]);

  if (!resolvedManifest) {
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <StandaloneRuntime
      manifest={resolvedManifest}
      mode={mode}
      reducedMotion={false}
      forceSequence={forceSequence}
    />
  );
}
