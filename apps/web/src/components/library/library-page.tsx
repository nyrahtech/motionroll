"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createProjectAction } from "@/app/actions";
import { UserMenu } from "@/components/auth/user-menu";
import { NewProjectModal } from "./new-project-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WorkspaceDegradedBanner } from "@/components/app/workspace-degraded-banner";
import { getProjectCoverUrl } from "@/lib/project-assets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProjectListItem = Awaited<ReturnType<typeof import("@/lib/data/projects").getRecentProjects>>[number];

const PRESET_LABELS: Record<string, string> = {
  "scroll-sequence": "Scroll Sequence",
  "product-reveal": "Product Reveal",
  "feature-walkthrough": "Feature Walkthrough",
  "before-after": "Before / After",
  "device-spin": "Device Spin",
  "chaptered-scroll-story": "Chaptered",
};

const PRESET_THUMBNAIL: Record<string, string> = {
  "product-reveal": "/thumbnails/product-reveal.png",
  "scroll-sequence": "/thumbnails/scroll-sequence.png",
  "feature-walkthrough": "/thumbnails/feature-walkthrough.png",
  "device-spin": "/thumbnails/device-spin.png",
  "before-after": "/thumbnails/before-after.png",
  "chaptered-scroll-story": "/thumbnails/chaptered-scroll-story.png",
};

const PAGE_SIZE = 20;

function getProjectCover(project: ProjectListItem) {
  return getProjectCoverUrl(project);
}

function getProjectStatus(project: ProjectListItem) {
  const hostedTarget = project.publishTargets.find((t) => t.targetType === "hosted_embed");
  if (hostedTarget?.publishedAt && new Date(project.updatedAt).getTime() > new Date(hostedTarget.publishedAt).getTime())
    return { label: "Needs republish", color: "#facc15" };
  if (hostedTarget?.publishedAt) return { label: "Published", color: "var(--editor-accent)" };
  if (hostedTarget?.isReady) return { label: "Ready", color: "var(--editor-text-dim)" };
  return { label: project.status, color: "var(--editor-text-dim)" };
}

async function readJsonError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({ error: fallback }))) as {
    error?: string;
  };
  return data.error ?? fallback;
}

function ProjectCard({
  project,
  href,
  archived = false,
  prioritizeImage = false,
}: {
  project: ProjectListItem;
  href: Route;
  archived?: boolean;
  prioritizeImage?: boolean;
}) {
  const router = useRouter();
  const status = getProjectStatus(project);
  const cover = getProjectCover(project);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.title);
  const [optimisticTitle, setOptimisticTitle] = useState(project.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isRenaming) renameInputRef.current?.focus(); }, [isRenaming]);

  async function commitRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === optimisticTitle) { setIsRenaming(false); return; }
    setOptimisticTitle(trimmed);
    setIsRenaming(false);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (!res.ok) {
      setOptimisticTitle(project.title);
      toast.error(await readJsonError(res, "Rename failed."));
      return;
    }
    toast.success("Project renamed");
    router.refresh();
  }

  async function runProjectAction(
    path: string,
    options: { method: "POST" | "DELETE"; success: string; failure: string; onSuccess?: () => void },
  ) {
    const response = await fetch(path, { method: options.method });
    if (!response.ok) {
      toast.error(await readJsonError(response, options.failure));
      return false;
    }
    options.onSuccess?.();
    toast.success(options.success);
    router.refresh();
    return true;
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const deleted = await runProjectAction(`/api/projects/${project.id}`, {
      method: "DELETE",
      success: "Project deleted",
      failure: "Delete failed.",
      onSuccess: () => setConfirmDelete(false),
    });
    if (!deleted) {
      setConfirmDelete(false);
    }
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border transition-transform hover:scale-[1.01]" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}>
      <Link
        href={href}
        data-project-card
        aria-label={`${archived ? "View" : "Open"} ${optimisticTitle}`}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editor-panel)]"
      >
        <div className="relative aspect-video overflow-hidden" style={{ background: "var(--editor-shell)", position: "relative" }}>
          {cover ? (
            <Image
              src={cover}
              alt={optimisticTitle}
              fill
              className="object-cover"
              unoptimized
              priority={prioritizeImage}
              loading={prioritizeImage ? "eager" : "lazy"}
            />
          ) : <div className="flex h-[96px] items-center justify-center"><span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>No preview</span></div>}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded px-4 py-1.5 text-sm font-medium" style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}>{archived ? "View" : "Open"}</span>
          </div>
        </div>
      </Link>
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input ref={renameInputRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename} onKeyDown={(e) => { if (e.key === "Enter") void commitRename(); if (e.key === "Escape") { setRenameValue(optimisticTitle); setIsRenaming(false); } }}
              className="w-full rounded border bg-transparent px-2 py-1 text-sm font-medium outline-none"
              style={{ borderColor: "var(--editor-accent)", color: "var(--editor-text)" }} />
          ) : (
            <p className="truncate text-sm font-medium" style={{ color: "var(--editor-text)" }}>{optimisticTitle}</p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs" style={{ color: status.color }}>{status.label}</span>
            <span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>-</span>
            <span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>{new Date(project.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-[var(--editor-hover)]" style={{ color: "var(--editor-text-dim)" }} onClick={(e) => e.preventDefault()}>
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={async (e) => {
                e.preventDefault();
                await runProjectAction(`/api/projects/${project.id}/duplicate`, {
                  method: "POST",
                  success: "Project duplicated",
                  failure: "Duplicate failed.",
                });
              }}
            >
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); setRenameValue(optimisticTitle); setIsRenaming(true); }}><Pencil className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
            {archived ? (
              <DropdownMenuItem
                onClick={async (e) => {
                  e.preventDefault();
                  await runProjectAction(`/api/projects/${project.id}/restore`, {
                    method: "POST",
                    success: "Project restored",
                    failure: "Restore failed.",
                  });
                }}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" />Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onClick={async (e) => {
                  e.preventDefault();
                  await runProjectAction(`/api/projects/${project.id}/archive`, {
                    method: "POST",
                    success: "Project archived",
                    failure: "Archive failed.",
                  });
                }}
              >
                <Archive className="mr-2 h-4 w-4" />Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={(e) => { e.preventDefault(); void handleDelete(); }}><Trash2 className="mr-2 h-4 w-4" />{confirmDelete ? "Confirm delete" : "Delete"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function NewProjectCard({
  onCreate,
  isCreating,
}: {
  onCreate: () => void;
  isCreating: boolean;
}) {
  return (
    <button
      type="button"
      data-project-card
      aria-label="Create new project"
      disabled={isCreating}
      onClick={onCreate}
      className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors hover:border-[var(--editor-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editor-shell)] disabled:cursor-wait disabled:opacity-60"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border-light)" }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--editor-shell)" }}>
        <Plus className="h-5 w-5" style={{ color: "var(--editor-accent)" }} />
      </div>
      <span className="text-sm" style={{ color: "var(--editor-text-dim)" }}>
        {isCreating ? "Creating project..." : "Create New Project"}
      </span>
    </button>
  );
}

function CollapsibleSection({ title, subtitle, defaultOpen = true, children, action }: { title: string; subtitle: string; defaultOpen?: boolean; children: React.ReactNode; action?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-10">
      <button type="button" onClick={() => setOpen((o) => !o)} className="mb-4 flex w-full items-end justify-between gap-4 text-left">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--editor-text-dim)" }}>{title}</p>
          <h2 className="mt-1 flex items-center gap-1.5 text-lg font-semibold" style={{ color: "var(--editor-text)" }}>
            {subtitle}{open ? <ChevronDown className="h-4 w-4 opacity-50" /> : <ChevronRight className="h-4 w-4 opacity-50" />}
          </h2>
        </div>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </button>
      {open && children}
    </section>
  );
}

type SortKey = "lastOpened" | "lastModified" | "alpha";

export function LibraryPage({
  recentProjects,
  demoProjects,
  archivedProjects,
  workspaceDegraded = false,
  workspaceNotice,
}: {
  recentProjects: ProjectListItem[];
  demoProjects: ProjectListItem[];
  archivedProjects: ProjectListItem[];
  workspaceDegraded?: boolean;
  workspaceNotice?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [presetFilter, setPresetFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastOpened");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { const id = setTimeout(() => setDebouncedSearch(search), 150); return () => clearTimeout(id); }, [search]);

  const allPresets = useMemo(() => Array.from(new Set([...recentProjects, ...demoProjects].map((p) => p.selectedPreset))), [recentProjects, demoProjects]);

  const sortItems = useCallback((projects: ProjectListItem[]) => {
    return [...projects].sort((a, b) => {
      if (sortKey === "alpha") return a.title.localeCompare(b.title);
      if (sortKey === "lastModified") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return (b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0) - (a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0);
    });
  }, [sortKey]);

  const isFiltering = debouncedSearch.trim().length > 0 || presetFilter !== "all";

  // Keyboard navigation on the project grid
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    function handleKeyDown(e: KeyboardEvent) {
      const cards = Array.from(grid!.querySelectorAll<HTMLElement>("[data-project-card]"));
      const focused = document.activeElement as HTMLElement | null;
      const idx = focused ? cards.indexOf(focused) : -1;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        cards[idx + 1]?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        cards[Math.max(0, idx - 1)]?.focus();
      }
    }
    grid.addEventListener("keydown", handleKeyDown);
    return () => grid.removeEventListener("keydown", handleKeyDown);
  }, []);
  const hasAnyProjects = recentProjects.length > 0 || demoProjects.length > 0;

  const filteredAll = useMemo(() => {
    let result = [...recentProjects, ...demoProjects];
    if (debouncedSearch.trim()) { const q = debouncedSearch.toLowerCase(); result = result.filter((p) => p.title.toLowerCase().includes(q)); }
    if (presetFilter !== "all") result = result.filter((p) => p.selectedPreset === presetFilter);
    return sortItems(result);
  }, [debouncedSearch, presetFilter, recentProjects, demoProjects, sortItems]);

  const sortedRecent = useMemo(() => sortItems(recentProjects), [recentProjects, sortItems]);
  const sortedDemo = useMemo(() => sortItems(demoProjects), [demoProjects, sortItems]);

  const handleCreateProject = useCallback(async () => {
    if (isCreatingProject) {
      return;
    }

    setIsCreatingProject(true);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: "product-reveal" }),
    });

    if (!response.ok) {
      const message = await readJsonError(response, "Project creation failed.");
      if (response.status === 503) {
        router.replace("/library?workspace=create_failed");
        router.refresh();
      }
      toast.error(message);
      setIsCreatingProject(false);
      return;
    }

    const project = (await response.json()) as { id?: string };
    if (!project.id) {
      toast.error("Project creation failed.");
      setIsCreatingProject(false);
      return;
    }

    window.location.assign(`/projects/${project.id}`);
  }, [isCreatingProject, router]);

  return (
    <>
    <div className="flex min-h-screen flex-col" style={{ background: "var(--editor-shell)" }}>
      <header className="flex h-14 items-center justify-between border-b px-6" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--editor-accent)" }}>MotionRoll</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleCreateProject()}
            disabled={isCreatingProject}
            className="flex h-8 items-center gap-1.5 rounded px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
            style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
          >
            <Plus className="h-4 w-4" />{isCreatingProject ? "Creating..." : "New Project"}
          </button>
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--editor-text)" }}>Projects</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={presetFilter} onValueChange={setPresetFilter}>
                <SelectTrigger className="h-10 min-w-[156px] rounded-md bg-[var(--editor-panel)]">
                  <SelectValue placeholder="All presets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All presets</SelectItem>
                  {allPresets.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PRESET_LABELS[id] ?? id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="h-10 min-w-[156px] rounded-md bg-[var(--editor-panel)]">
                  <SelectValue placeholder="Last opened" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lastOpened">Last opened</SelectItem>
                  <SelectItem value="lastModified">Last modified</SelectItem>
                  <SelectItem value="alpha">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--editor-text-dim)" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="h-10 w-full rounded-md border bg-transparent pl-10 pr-4 text-sm outline-none focus:border-[var(--editor-accent)]" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)", color: "var(--editor-text)" }} />
              </div>
            </div>
          </div>

          {workspaceNotice ? <WorkspaceDegradedBanner message={workspaceNotice} /> : null}
          {workspaceDegraded && <WorkspaceDegradedBanner />}

          {!hasAnyProjects && !workspaceDegraded && (
            <div className="rounded-lg border p-12 text-center" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}>
              <p className="text-lg font-semibold" style={{ color: "var(--editor-text)" }}>No projects yet</p>
              <p className="mt-2 text-sm" style={{ color: "var(--editor-text-dim)" }}>Create a new project to get started.</p>
              <button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={isCreatingProject}
                className="mt-4 inline-block rounded px-6 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-70"
                style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
              >
                {isCreatingProject ? "Creating..." : "Create your first project"}
              </button>
            </div>
          )}

          {!hasAnyProjects && workspaceDegraded && (
            <div className="rounded-lg border p-12 text-center" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}>
              <p className="text-lg font-semibold" style={{ color: "var(--editor-text)" }}>Projects are temporarily unavailable</p>
              <p className="mt-2 text-sm" style={{ color: "var(--editor-text-dim)" }}>
                MotionRoll couldn't load your workspace data just now. Try refreshing in a moment.
              </p>
            </div>
          )}

          {isFiltering && hasAnyProjects && (
            <>
              <p className="mb-4 text-sm" style={{ color: "var(--editor-text-dim)" }}>{filteredAll.length} result{filteredAll.length !== 1 ? "s" : ""}{debouncedSearch ? ` for "${debouncedSearch}"` : ""}</p>
              <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredAll.slice(0, visibleCount).map((p, index) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    href={`/projects/${p.id}` as Route}
                    prioritizeImage={index < 2}
                  />
                ))}
              </div>
              {filteredAll.length > visibleCount && (
                <div className="mt-6 text-center">
                  <button type="button" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="rounded border px-6 py-2 text-sm transition-colors hover:bg-[var(--editor-hover)]" style={{ borderColor: "var(--editor-border)", color: "var(--editor-text)" }}>
                    Show more ({filteredAll.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}

          {!isFiltering && hasAnyProjects && (
            <>
              {demoProjects.length > 0 && (
                <CollapsibleSection title="Demo Projects" subtitle="Open something visual immediately" defaultOpen={true} action={<Link href="/templates" className="text-sm hover:underline" style={{ color: "var(--editor-accent)" }}>Browse templates -&gt;</Link>}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sortedDemo.map((p, index) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        href={`/projects/${p.id}` as Route}
                        prioritizeImage={index < 2}
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}
              <CollapsibleSection title="Recent Projects" subtitle="Continue editing" defaultOpen={true}>
                {recentProjects.length === 0 ? (
                  <div className="rounded-lg border p-8 text-center" style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}><p className="text-sm" style={{ color: "var(--editor-text-dim)" }}>No projects created yet.</p></div>
                ) : (
                  <>
                    <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {sortedRecent.slice(0, visibleCount).map((p, index) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          href={`/projects/${p.id}` as Route}
                          prioritizeImage={index === 0 && sortedDemo.length === 0}
                        />
                      ))}
                      <NewProjectCard onCreate={() => void handleCreateProject()} isCreating={isCreatingProject} />
                    </div>
                    {sortedRecent.length > visibleCount && (
                      <div className="mt-6 text-center">
                        <button type="button" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="rounded border px-6 py-2 text-sm" style={{ borderColor: "var(--editor-border)", color: "var(--editor-text)" }}>Show more ({sortedRecent.length - visibleCount} remaining)</button>
                      </div>
                    )}
                  </>
                )}
              </CollapsibleSection>
              {archivedProjects.length > 0 && (
                <CollapsibleSection title="Archived" subtitle="Restore work you set aside" defaultOpen={false}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {archivedProjects.map((p) => <ProjectCard key={p.id} project={p} href={`/projects/${p.id}` as Route} archived />)}
                  </div>
                </CollapsibleSection>
              )}
            </>
          )}
        </div>
      </div>
    </div>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
    </>
  );
}
