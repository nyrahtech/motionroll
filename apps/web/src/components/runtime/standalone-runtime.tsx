"use client";

import { useEffect, useRef } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import { createScrollSection, type ScrollSectionController } from "@motionroll/runtime";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function hasRenderableSectionContent(section: ProjectManifest["sections"][number]) {
  return (
    Boolean(section.backgroundMedia?.url || section.backgroundMedia?.previewUrl) ||
    Boolean(section.frameAssets.length) ||
    Boolean(section.fallback.posterUrl) ||
    Boolean(section.fallback.fallbackVideoUrl) ||
    Boolean(section.overlays.length)
  );
}

function hasRenderableCanvasContent(manifest: ProjectManifest) {
  return (
    Boolean(manifest.canvas.backgroundTrack?.media.url || manifest.canvas.backgroundTrack?.media.previewUrl) ||
    Boolean(manifest.canvas.frameAssets.length) ||
    Boolean(manifest.canvas.fallback.posterUrl) ||
    Boolean(manifest.canvas.fallback.fallbackVideoUrl) ||
    Boolean(manifest.layers.length)
  );
}

export function StandaloneRuntime({
  manifest,
  mode = "desktop",
  reducedMotion = false,
  forceSequence = false,
  className,
}: {
  manifest: ProjectManifest;
  mode?: "desktop" | "mobile";
  reducedMotion?: boolean;
  forceSequence?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ScrollSectionController | null>(null);
  const section = manifest.sections[0];
  const hasRenderableMedia =
    hasRenderableCanvasContent(manifest) || manifest.sections.some(hasRenderableSectionContent);

  useEffect(() => {
    if (!hasRenderableMedia) {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      if (typeof window !== "undefined" && window.parent !== window) {
        window.parent.postMessage({ type: "motionroll-preview-ready", status: "empty" }, "*");
      }
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    controllerRef.current?.destroy();
    node.replaceChildren();
    controllerRef.current = createScrollSection(node, manifest, {
      mode,
      reducedMotion,
      interactionMode: "scroll",
      allowWheelScrub: false,
      forceSequence,
    });
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "motionroll-preview-ready", status: "ready" }, "*");
    }

    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [forceSequence, hasRenderableMedia, manifest, mode, reducedMotion]);

  if (!hasRenderableMedia) {
    return (
      <div
        className={cn("grid min-h-screen place-items-center bg-black px-6", className)}
      >
        <div className="max-w-xl rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--panel-bg)] p-6 text-center">
          <Badge>{section?.presetId ?? "preview"}</Badge>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
            This preview does not have media attached yet.
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
            Upload a source video or processed frame sequence in the editor, then reopen preview to see the full runtime.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={cn("relative bg-black", className)} />;
}
