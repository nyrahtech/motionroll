"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import { ArrowLeft, Check, Copy, ExternalLink, Monitor, Smartphone, Tablet, X } from "lucide-react";
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
  const [previewFrameState, setPreviewFrameState] = useState<"loading" | "ready" | "error">("loading");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const embedDialogRef = useRef<HTMLDialogElement | null>(null);
  const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);

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
  const isDraftPreview = !manifestState.publishTarget.publishedAt || needsRepublish;
  const runtimePreviewUrl = useMemo(() => {
    const baseUrl = isDraftPreview ? `/projects/${projectState.id}/preview` : manifestState.publishTarget.previewUrl;
    const params = new URLSearchParams({
      mode: runtimeMode,
      forceSequence: "1",
    });
    if (isDraftPreview) {
      params.set("embed", "1");
    }
    const joiner = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${joiner}${params.toString()}`;
  }, [
    isDraftPreview,
    manifestState.publishTarget.previewUrl,
    projectState.id,
    runtimeMode,
  ]);
  const isDesktopPreview = device === "desktop";
  const previewSurfaceHeight = isDesktopPreview ? "min(68vh, 840px)" : `${dims.h}px`;
  const hasPublishedOutput = Boolean(manifestState.publishTarget.publishedAt);

  useEffect(() => {
    setPreviewFrameState("loading");
    const timeoutId = window.setTimeout(() => {
      setPreviewFrameState((current) => (current === "ready" ? current : "error"));
    }, 6000);

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const data = event.data as { type?: string } | null;
      if (data?.type === "motionroll-preview-ready") {
        window.clearTimeout(timeoutId);
        setPreviewFrameState("ready");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
    };
  }, [runtimePreviewUrl]);

  useEffect(() => {
    const dialog = embedDialogRef.current;
    if (!dialog) return;
    if (isEmbedDialogOpen) {
      dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isEmbedDialogOpen]);

  function handleEmbedDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = embedDialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      setIsEmbedDialogOpen(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--editor-shell)" }}>
      <header
        className="grid min-h-14 grid-cols-1 items-center gap-3 border-b px-6 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
        style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
      >
        <div className="flex items-center gap-4 md:justify-self-start">
          <span className="text-sm font-semibold" style={{ color: "var(--editor-accent)" }}>
            MotionRoll
          </span>
          <div className="h-4 w-px" style={{ background: "var(--editor-border)" }} />
          <Link
            href={`/projects/${project.id}`}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: "var(--editor-text)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Editor
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 md:justify-self-center">
          <div className="flex items-center gap-1 rounded p-1" style={{ background: "var(--editor-panel-elevated)" }}>
            {(["desktop", "tablet", "mobile"] as const).map((d) => {
              const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
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
                Ready
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#facc15" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                {readiness.blockedCount} blocked
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end md:justify-self-end">
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
          {publishError ? (
            <div
              className="rounded-lg border px-4 py-3 text-sm"
              style={{
                background: "rgba(248,113,113,0.08)",
                borderColor: "rgba(248,113,113,0.24)",
                color: "#fca5a5",
              }}
            >
              {publishError}
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--editor-text)" }}>
              {projectState.title}
            </h1>
            <p className="text-sm" style={{ color: "var(--editor-text-dim)" }}>
              Review the live publication surface, then publish when the sequence is ready.
            </p>
          </div>

          <section className={`flex min-w-0 flex-col gap-4 ${isDesktopPreview ? "w-full" : "items-center"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-medium" style={{ color: "var(--editor-text)" }}>
                  Published URL
                </h2>
                <p className="mt-1 break-all text-xs" style={{ color: "var(--editor-accent)" }}>
                  {manifestState.publishTarget.previewUrl}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={manifestState.publishTarget.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="interactive-soft flex items-center gap-1 rounded px-1.5 py-1 text-xs"
                  style={{ color: "var(--editor-text-dim)" }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
                <button
                  onClick={() => copyValue("url", manifestState.publishTarget.previewUrl)}
                  className="interactive-soft flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs"
                  style={{
                    background: "var(--editor-shell)",
                    border: "1px solid var(--editor-border)",
                    color: copiedKey === "url" ? "var(--editor-accent)" : "var(--editor-text)",
                  }}
                >
                  {copiedKey === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey === "url" ? "Copied!" : "Copy URL"}
                </button>
                {hasPublishedOutput ? (
                  <button
                    type="button"
                    onClick={() => setIsEmbedDialogOpen(true)}
                    className="interactive-soft flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs"
                    style={{
                      background: "var(--editor-shell)",
                      border: "1px solid var(--editor-border)",
                      color: "var(--editor-text)",
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Embed code
                  </button>
                ) : null}
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-xl shadow-2xl"
              style={{
                width: "100%",
                background: "#000",
                border: "1px solid var(--editor-border)",
                minHeight: previewSurfaceHeight,
              }}
            >
              <div
                className={isDesktopPreview ? "h-full w-full" : "mx-auto"}
                style={{
                  width: isDesktopPreview ? "100%" : `${dims.w}px`,
                  maxWidth: "100%",
                  height: previewSurfaceHeight,
                }}
              >
                {previewFrameState === "error" ? (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center"
                    style={{ background: "rgba(0,0,0,0.82)", color: "var(--editor-text)" }}
                  >
                    <h2 className="text-base font-semibold">Preview couldn&apos;t load here.</h2>
                    <p className="max-w-md text-sm" style={{ color: "var(--editor-text-dim)" }}>
                      The embedded runtime did not report ready. Open the preview directly to inspect the auth or route error.
                    </p>
                    <a
                      href={runtimePreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="interactive-soft rounded px-3 py-2 text-sm font-medium"
                      style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
                    >
                      Open preview
                    </a>
                  </div>
                ) : null}
                <iframe
                  ref={iframeRef}
                  key={runtimePreviewUrl}
                  src={runtimePreviewUrl}
                  title={`${projectState.title} ${device} runtime preview`}
                  className="h-full w-full bg-black"
                  style={{ border: 0 }}
                  loading="eager"
                  allow="autoplay; fullscreen"
                  onLoad={() => {
                    window.setTimeout(() => {
                      setPreviewFrameState((current) => (current === "loading" ? "error" : current));
                    }, 1500);
                  }}
                  onError={() => setPreviewFrameState("error")}
                />
              </div>
            </div>

            <div
              className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
              style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
            >
              <div
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  background: readiness.ready ? "rgba(103,232,249,0.12)" : "rgba(250,204,21,0.12)",
                  color: readiness.ready ? "var(--editor-accent)" : "#facc15",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                {readiness.ready ? "Ready" : `${readiness.blockedCount} blocked`}
              </div>

              <div className="flex flex-1 flex-wrap items-center gap-2">
                {readiness.checks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                    style={{
                      background:
                        check.status === "ready"
                          ? "rgba(103,232,249,0.12)"
                          : check.status === "warning"
                            ? "rgba(250,204,21,0.12)"
                            : "rgba(248,113,113,0.12)",
                      color:
                        check.status === "ready"
                          ? "var(--editor-accent)"
                          : check.status === "warning"
                            ? "#facc15"
                            : "#f87171",
                    }}
                    title={check.message}
                  >
                    <span className="font-medium" style={{ color: "var(--editor-text)" }}>
                      {check.label}
                    </span>
                    <span>{check.status === "ready" ? "OK" : "Not OK"}</span>
                  </div>
                ))}
              </div>

              {needsRepublish ? (
                <span
                  className="rounded-full px-3 py-1.5 text-xs"
                  style={{ background: "rgba(250,204,21,0.1)", color: "#facc15" }}
                >
                  Changes since publish
                </span>
              ) : null}

              <button
                onClick={finalizePublish}
                disabled={!readiness.ready || publishState === "publishing"}
                className="interactive-soft ml-auto flex h-10 items-center justify-center gap-1.5 rounded px-4 text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
              >
                {publishState === "publishing"
                  ? "Publishing..."
                  : publishState === "published"
                    ? "Published!"
                    : "Publish"}
              </button>
            </div>
          </section>
        </div>
      </div>

      <dialog
        ref={embedDialogRef}
        onClick={handleEmbedDialogClick}
        onClose={() => setIsEmbedDialogOpen(false)}
        className="m-auto max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[16px] border p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        style={{
          background: "var(--editor-panel)",
          borderColor: "var(--editor-border)",
          color: "var(--editor-text)",
        }}
      >
        <div className="flex h-14 items-center justify-between border-b px-6" style={{ borderColor: "var(--editor-border)" }}>
          <span className="text-sm font-semibold">Embed code</span>
          <button
            type="button"
            onClick={() => setIsEmbedDialogOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" style={{ color: "var(--editor-text-dim)" }} />
          </button>
        </div>

        <div className="space-y-3 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm" style={{ color: "var(--editor-text-dim)" }}>
              Use this snippet to embed MotionRoll into your website.
            </p>
            <button
              onClick={() => copyValue("code", embedCode)}
              className="interactive-soft flex h-8 items-center gap-1.5 rounded px-3 text-xs"
              style={{
                background: "var(--editor-shell)",
                border: "1px solid var(--editor-border)",
                color: copiedKey === "code" ? "var(--editor-accent)" : "var(--editor-text)",
              }}
            >
              {copiedKey === "code" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedKey === "code" ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre
            className="overflow-x-auto rounded p-4 text-xs leading-5"
            style={{
              background: "var(--editor-shell)",
              color: "var(--editor-text-dim)",
              fontFamily: "monospace",
            }}
          >
            {embedCode}
          </pre>
        </div>
      </dialog>
    </div>
  );
}
