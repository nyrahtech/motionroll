"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getProjectCoverUrl } from "../../lib/project-assets";
import { ProjectActionsMenu } from "./project-actions-menu";
import type { LibraryProjectListItem } from "./types";

type PendingAction = "rename" | "duplicate" | "delete" | null;

function getProjectStatus(project: LibraryProjectListItem) {
  const hostedTarget = project.publishTargets.find((target) => target.targetType === "hosted_embed");
  if (
    hostedTarget?.publishedAt &&
    new Date(project.updatedAt).getTime() > new Date(hostedTarget.publishedAt).getTime()
  ) {
    return { label: "Needs republish", color: "#facc15" };
  }
  if (hostedTarget?.publishedAt) {
    return { label: "Published", color: "var(--editor-accent)" };
  }
  if (hostedTarget?.isReady) {
    return { label: "Ready", color: "var(--editor-text-dim)" };
  }
  return { label: project.status, color: "var(--editor-text-dim)" };
}

async function readJsonError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({ error: fallback }))) as {
    error?: string;
  };
  return data.error ?? fallback;
}

export function ProjectCard({
  project,
  href,
  prioritizeImage = false,
}: {
  project: LibraryProjectListItem;
  href: Route;
  prioritizeImage?: boolean;
}) {
  const router = useRouter();
  const status = getProjectStatus(project);
  const cover = getProjectCoverUrl(project);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.title);
  const [optimisticTitle, setOptimisticTitle] = useState(project.title);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const isPending = pendingAction !== null;
  const isDeletePending = pendingAction === "delete";

  useEffect(() => {
    if (isRenaming && !isPending) {
      renameInputRef.current?.focus();
    }
  }, [isPending, isRenaming]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) {
      return;
    }

    if (isDeleteDialogOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [isDeleteDialogOpen]);

  async function runProjectAction(
    path: string,
    options: { method: "POST" | "DELETE"; success: string; failure: string; onSuccess?: () => void },
  ) {
    try {
      const response = await fetch(path, { method: options.method });
      if (!response.ok) {
        toast.error(await readJsonError(response, options.failure));
        return false;
      }

      options.onSuccess?.();
      toast.success(options.success);
      router.refresh();
      return true;
    } catch {
      toast.error(options.failure);
      return false;
    }
  }

  async function commitRename() {
    if (pendingAction !== null) {
      return;
    }

    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === optimisticTitle) {
      setIsRenaming(false);
      return;
    }

    const previousTitle = optimisticTitle;
    setOptimisticTitle(trimmed);
    setRenameValue(trimmed);
    setPendingAction("rename");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!response.ok) {
        setOptimisticTitle(previousTitle);
        setRenameValue(previousTitle);
        toast.error(await readJsonError(response, "Rename failed."));
        return;
      }

      setIsRenaming(false);
      toast.success("Project renamed");
      router.refresh();
    } catch {
      setOptimisticTitle(previousTitle);
      setRenameValue(previousTitle);
      toast.error("Rename failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (pendingAction !== null) {
      return;
    }

    setPendingAction("delete");
    try {
      await runProjectAction(`/api/projects/${project.id}`, {
        method: "DELETE",
        success: "Project deleted",
        failure: "Delete failed.",
        onSuccess: () => setIsDeleteDialogOpen(false),
      });
    } finally {
      setPendingAction(null);
    }
  }

  function handleDeleteDialogClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (isDeletePending) {
      return;
    }

    if (event.target === event.currentTarget) {
      setIsDeleteDialogOpen(false);
    }
  }

  return (
    <>
      <article
        className="group relative overflow-hidden rounded-[var(--radius-lg)] border"
        style={{
          background: "color-mix(in srgb, var(--editor-panel) 38%, var(--editor-shell))",
          borderColor: "color-mix(in srgb, var(--editor-border) 70%, transparent)",
        }}
      >
        <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "var(--editor-shell)" }}>
          <Link
            href={href}
            data-project-card
            aria-label={`Open ${optimisticTitle}`}
            aria-disabled={isPending}
            onClick={(event) => {
              if (isPending) {
                event.preventDefault();
              }
            }}
            className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editor-panel)]"
          />

          {cover ? (
            <Image
              src={cover}
              alt={optimisticTitle}
              fill
              className="pointer-events-none object-cover"
              unoptimized
              priority={prioritizeImage}
              loading={prioritizeImage ? "eager" : "lazy"}
            />
          ) : (
            <div className="pointer-events-none flex h-full items-center justify-center">
              <span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>
                No preview
              </span>
            </div>
          )}

          <div
            data-project-card-overlay
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 px-3 py-3 backdrop-blur-lg"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--editor-shell) 12%, transparent) 0%, color-mix(in srgb, var(--editor-shell) 54%, transparent) 26%, color-mix(in srgb, var(--editor-shell) 84%, transparent) 100%)",
            }}
          >
            <div className="flex h-full items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                {isRenaming ? (
                  <div className="pointer-events-auto">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      disabled={isPending}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={() => void commitRename()}
                      onKeyDown={(event) => {
                        if (isPending) {
                          return;
                        }
                        if (event.key === "Enter") {
                          void commitRename();
                        }
                        if (event.key === "Escape") {
                          setRenameValue(optimisticTitle);
                          setIsRenaming(false);
                        }
                      }}
                      className="w-full rounded-[var(--radius-sm)] border bg-transparent px-2 py-1 text-sm font-medium outline-none"
                      style={{ borderColor: "var(--editor-accent)", color: "var(--editor-text)" }}
                    />
                  </div>
                ) : (
                  <p className="truncate text-sm font-medium leading-5" style={{ color: "var(--editor-text)" }}>
                    {optimisticTitle}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--editor-text-dim)" }}>
                  <span style={{ color: status.color }}>{status.label}</span>
                  <span>-</span>
                  <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="pointer-events-auto flex h-8 items-center">
                {pendingAction === "rename" || pendingAction === "duplicate" ? (
                  <span
                    aria-label={`${pendingAction === "rename" ? "Rename" : "Duplicate"} in progress`}
                    className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--editor-text-dim)] border-t-transparent"
                  />
                ) : (
                  <ProjectActionsMenu
                    disabled={isPending}
                    loading={isPending}
                    onRename={() => {
                      if (isPending) {
                        return;
                      }
                      window.setTimeout(() => {
                        setRenameValue(optimisticTitle);
                        setIsRenaming(true);
                      }, 0);
                    }}
                    onDuplicate={async () => {
                      if (pendingAction !== null) {
                        return;
                      }
                      setPendingAction("duplicate");
                      try {
                        await runProjectAction(`/api/projects/${project.id}/duplicate`, {
                          method: "POST",
                          success: "Project duplicated",
                          failure: "Duplicate failed.",
                        });
                      } finally {
                        setPendingAction(null);
                      }
                    }}
                    onDelete={() => {
                      if (isPending) {
                        return;
                      }
                      setIsDeleteDialogOpen(true);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </article>

      {isDeleteDialogOpen ? (
        <dialog
          ref={deleteDialogRef}
          onClick={handleDeleteDialogClick}
          onCancel={(event) => {
            if (isDeletePending) {
              event.preventDefault();
            }
          }}
          onClose={() => {
            if (!isDeletePending) {
              setIsDeleteDialogOpen(false);
            }
          }}
          className="m-auto w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-[16px] border p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          style={{
            background: "var(--editor-panel)",
            borderColor: "var(--editor-border)",
            color: "var(--editor-text)",
          }}
        >
          <div className="px-6 py-7 text-center">
            <div
              aria-label="Delete warning"
              className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border"
              style={{
                background: "var(--editor-panel-elevated)",
                borderColor: "var(--editor-border)",
                color: "#fca5a5",
              }}
            >
              <AlertTriangle className="h-14 w-14" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">Delete project?</h2>
            <p className="text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
              This will permanently delete <span style={{ color: "var(--editor-text)" }}>{optimisticTitle}</span>.
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-5 py-4" style={{ borderColor: "var(--editor-border)" }}>
            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeletePending}
              className="focus-ring inline-flex h-8 items-center justify-center rounded-[var(--radius-md)] border border-transparent px-3 text-sm font-medium transition-colors hover:bg-[var(--editor-hover)]"
              style={{ color: "var(--editor-text-dim)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeletePending}
              className="focus-ring inline-flex h-8 items-center justify-center rounded-[var(--radius-md)] border px-3 text-sm font-medium transition-colors"
              style={{
                background: "rgba(239, 68, 68, 0.14)",
                borderColor: "rgba(239, 68, 68, 0.22)",
                color: "#fca5a5",
              }}
            >
              {isDeletePending ? (
                <>
                  <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deleting...
                </>
              ) : (
                "Delete project"
              )}
            </button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
