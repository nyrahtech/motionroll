"use client";

import { useMemo, useState } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import { ArrowLeft, Check, Copy, ExternalLink, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { UserMenu } from "@/components/auth/user-menu";

export function PublishPanel({
  project,
  readiness,
  manifest,
}: {
  project: { id: string; title: string; slug: string; publishVersion?: number; updatedAt: string };
  readiness: {
    ready: boolean;
    blockedCount: number;
    warningCount: number;
    reasons: string[];
    checks: Array<{ id: string; label: string; status: "ready" | "blocked" | "warning"; message: string }>;
  };
  manifest: ProjectManifest;
}) {
  const [projectState, setProjectState] = useState(project);
  const [manifestState, setManifestState] = useState(manifest);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "failed">("idle");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [publishError, setPublishError] = useState<string | null>(null);

  const embedCode = useMemo(
    () =>
      `<div id="motionroll-root"></div>\n<script type="module">\n  import { createScrollSection } from "@motionroll/runtime";\n  const res = await fetch("/api/publish/${manifestState.publishTarget?.slug ?? ""}");\n  const { manifest } = await res.json();\n  createScrollSection(document.getElementById("motionroll-root"), manifest);\n</script>`,
    [manifestState.publishTarget.slug],
  );

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function finalizePublish() {
    setPublishState("publishing");
    setPublishError(null);
    const response = await fetch(`/api/projects/${project.id}/publish`, { method: "POST" });
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({ error: "Publish failed." }))) as {
        error?: string;
      };
      const message = errorData.error ?? "Publish failed.";
      setPublishState("failed");
      setPublishError(message);
      toast.error(message);
      return;
    }
    const data = (await response.json()) as { manifest: ProjectManifest; project?: typeof project };
    setManifestState(data.manifest);
    if (data.project) setProjectState(data.project);
    setPublishState("published");
    toast.success("Publish complete");
  }

  const needsRepublish =
    Boolean(manifestState.publishTarget.publishedAt) &&
    new Date(projectState.updatedAt).getTime() > new Date(manifestState.publishTarget.publishedAt ?? 0).getTime();

  const deviceDims = { desktop: { w: 1280, h: 720 }, tablet: { w: 768, h: 1024 }, mobile: { w: 390, h: 844 } };
  const dims = deviceDims[device];
  const runtimeMode = device === "desktop" ? "desktop" : "mobile";
  const runtimePreviewUrl = useMemo(() => {
    const baseUrl =
      !manifestState.publishTarget.publishedAt || needsRepublish
        ? `/projects/${projectState.id}/preview`
        : manifestState.publishTarget.previewUrl;
    const joiner = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${joiner}mode=${runtimeMode}&forceSequence=1`;
  }, [
    manifestState.publishTarget.previewUrl,
    manifestState.publishTarget.publishedAt,
    needsRepublish,
    projectState.id,
    runtimeMode,
  ]);
  const isDesktopPreview = device === "desktop";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--editor-shell)" }}>
      {/* Header */}
      <header
        className="flex h-14 items-center justify-between border-b px-6"
        style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${project.id}`}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: "var(--editor-text)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Editor
          </Link>
          <div className="h-4 w-px" style={{ background: "var(--editor-border)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--editor-accent)" }}>MotionRoll</span>
        </div>
        <UserMenu />

        {/* Device switcher */}
        <div className="flex items-center gap-1 rounded p-1" style={{ background: "var(--editor-panel-elevated)" }}>
          {(["desktop", "tablet", "mobile"] as const).map((d) => {
            const Icon = d === "desktop" ? Monitor : d === "mobile" ? Smartphone : Monitor;
            return (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className="flex h-7 items-center gap-1.5 rounded px-3 text-xs capitalize transition-colors"
                style={{
                  background: device === d ? "var(--editor-selected)" : "transparent",
                  color: device === d ? "var(--editor-accent)" : "var(--editor-text-dim)",
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {readiness.ready ? (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--editor-accent)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--editor-accent)" }} />
              Ready to publish
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#facc15" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              {readiness.blockedCount} blocked
            </span>
          )}
          <button
            onClick={finalizePublish}
            disabled={!readiness.ready || publishState === "publishing"}
            className="interactive-soft flex h-8 items-center gap-1.5 rounded px-4 text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
          >
            {publishState === "publishing" ? "Publishing..." : publishState === "published" ? "Published!" : "Publish"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex w-full flex-col gap-6">
        {publishError ? (
          <div
            className="mx-auto w-full max-w-[1200px] rounded-lg border px-4 py-3 text-sm"
            style={{
              background: "rgba(248,113,113,0.08)",
              borderColor: "rgba(248,113,113,0.24)",
              color: "#fca5a5",
            }}
          >
            {publishError}
          </div>
        ) : null}
        {/* Preview pane */}
        <div className={`flex flex-col gap-4 ${isDesktopPreview ? "w-full" : "items-center"}`}>
          <div className="text-center">
            <h1 className="text-xl font-semibold" style={{ color: "var(--editor-text)" }}>{projectState.title}</h1>
            <p className="text-sm mt-1" style={{ color: "var(--editor-text-dim)" }}>
              Preview how your sequence looks at publication
            </p>
          </div>

          <div
            className="overflow-hidden rounded-none shadow-2xl"
            style={{
              width: isDesktopPreview ? "100%" : `${dims.w}px`,
              maxWidth: isDesktopPreview ? "none" : "100%",
              height: isDesktopPreview ? "min(72vh, 900px)" : `${dims.h}px`,
              background: "#000",
              border: "1px solid var(--editor-border)",
            }}
          >
            <iframe
              key={runtimePreviewUrl}
              src={runtimePreviewUrl}
              title={`${projectState.title} ${device} runtime preview`}
              className="h-full w-full bg-black"
              style={{ border: 0 }}
              loading="eager"
              allow="autoplay; fullscreen"
            />
          </div>
          <p className="text-xs" style={{ color: "var(--editor-text-dim)" }}>
            {!manifestState.publishTarget.publishedAt || needsRepublish
              ? "Showing the current draft runtime."
              : "Showing the currently published runtime."}
          </p>
        </div>

        {/* Status panel */}
        <div className="mx-auto grid w-full max-w-[1200px] gap-4 md:grid-cols-2">
          {/* Status card */}
          <div
            className="rounded-lg border p-5 space-y-3"
            style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
          >
            <h3 className="text-sm font-medium" style={{ color: "var(--editor-text)" }}>Readiness</h3>
            <div className="space-y-2">
              {readiness.checks.map((check) => (
                <div key={check.id} className="flex items-start gap-2">
                  <div
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center text-xs"
                    style={{
                      background: check.status === "ready"
                        ? "rgba(103,232,249,0.15)"
                        : check.status === "warning"
                          ? "rgba(250,204,21,0.15)"
                          : "rgba(248,113,113,0.15)",
                      color: check.status === "ready" ? "var(--editor-accent)" : check.status === "warning" ? "#facc15" : "#f87171",
                    }}
                  >
                    {check.status === "ready" ? "OK" : "!"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: "var(--editor-text)" }}>{check.label}</p>
                    <p className="text-xs" style={{ color: "var(--editor-text-dim)" }}>{check.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {needsRepublish && (
              <p className="text-xs px-3 py-2 rounded" style={{ background: "rgba(250,204,21,0.1)", color: "#facc15" }}>
                There are changes since last publish.
              </p>
            )}
          </div>

          {/* Preview URL */}
          {manifestState.publishTarget.previewUrl && (
            <div
              className="rounded-lg border p-5 space-y-3"
              style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium" style={{ color: "var(--editor-text)" }}>Preview URL</h3>
                <a
                  href={manifestState.publishTarget.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="interactive-soft text-xs flex items-center gap-1 rounded px-1.5 py-1"
                  style={{ color: "var(--editor-text-dim)" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
              </div>
              <p className="break-all text-xs" style={{ color: "var(--editor-accent)" }}>
                {manifestState.publishTarget.previewUrl}
              </p>
              <button
                onClick={() => copyValue("url", manifestState.publishTarget.previewUrl)}
                className="interactive-soft flex h-7 w-full items-center justify-center gap-1.5 rounded text-xs"
                style={{ background: "var(--editor-shell)", border: "1px solid var(--editor-border)", color: "var(--editor-text)" }}
              >
                {copiedKey === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey === "url" ? "Copied!" : "Copy URL"}
              </button>
            </div>
          )}

        </div>

        {/* Embed code */}
        <div
          className="mx-auto w-full max-w-[1200px] rounded-lg border p-5 space-y-3"
          style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium" style={{ color: "var(--editor-text)" }}>Embed Code</h3>
            <button
              onClick={() => copyValue("code", embedCode)}
              className="interactive-soft flex h-7 items-center gap-1.5 rounded px-2 text-xs"
              style={{ color: copiedKey === "code" ? "var(--editor-accent)" : "var(--editor-text-dim)" }}
            >
              {copiedKey === "code" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedKey === "code" ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre
            className="overflow-x-auto rounded p-3 text-xs leading-5"
            style={{ background: "var(--editor-shell)", color: "var(--editor-text-dim)", fontFamily: "monospace" }}
          >
            {embedCode}
          </pre>
        </div>
        </div>
      </div>
    </div>
  );
}
