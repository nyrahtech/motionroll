"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Archive, ArchiveRestore, MoreVertical, Plus, Search } from "lucide-react";
import { createProjectAction } from "@/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProjectListItem = Awaited<
  ReturnType<typeof import("@/lib/data/projects").getRecentProjects>
>[number];

function getProjectCover(project: ProjectListItem) {
  return (
    project.assets.find((asset) => asset.kind === "poster")?.publicUrl ??
    project.template?.thumbnailUrl ??
    "/thumbnails/product-reveal.png"
  );
}

function getProjectStatus(project: ProjectListItem) {
  const hostedTarget = project.publishTargets.find((t) => t.targetType === "hosted_embed");
  if (hostedTarget?.publishedAt && new Date(project.updatedAt).getTime() > new Date(hostedTarget.publishedAt).getTime()) {
    return { label: "Needs republish", color: "#facc15" };
  }
  if (hostedTarget?.publishedAt) return { label: "Published", color: "var(--editor-accent)" };
  if (hostedTarget?.isReady) return { label: "Ready", color: "var(--editor-text-dim)" };
  return { label: project.status, color: "var(--editor-text-dim)" };
}

function ProjectCard({ project, href, archived = false }: { project: ProjectListItem; href: Route; archived?: boolean }) {
  const status = getProjectStatus(project);
  const cover = getProjectCover(project);

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-lg border transition-transform hover:scale-[1.02]"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden" style={{ background: "var(--editor-shell)" }}>
        {cover ? (
          <img src={cover} alt={project.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-[96px] items-center justify-center">
            <span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>No preview</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            className="rounded px-4 py-1.5 text-sm font-medium"
            style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
          >
            {archived ? "View" : "Open"}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" style={{ color: "var(--editor-text)" }}>
            {project.title}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs" style={{ color: status.color }}>{status.label}</span>
            <span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>·</span>
            <span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>
              {new Date(project.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-[var(--editor-hover)]"
              style={{ color: "var(--editor-text-dim)" }}
              onClick={(e) => e.preventDefault()}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={async (e) => {
                e.preventDefault();
                const res = await fetch(`/api/projects/${project.id}/duplicate`, { method: "POST" });
                if (res.ok) window.location.reload();
              }}
            >
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/projects/${project.id}`}>Open / Rename</Link>
            </DropdownMenuItem>
            {archived ? (
              <DropdownMenuItem
                onClick={async (e) => {
                  e.preventDefault();
                  await fetch(`/api/projects/${project.id}/restore`, { method: "POST" });
                  window.location.reload();
                }}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onClick={async (e) => {
                  e.preventDefault();
                  await fetch(`/api/projects/${project.id}/archive`, { method: "POST" });
                  window.location.reload();
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
}

function NewProjectCard() {
  return (
    <form action={createProjectAction}>
      <input type="hidden" name="presetId" value="product-reveal" />
      <button
        type="submit"
        className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors hover:border-[var(--editor-accent)]"
        style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border-light)" }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--editor-shell)" }}
        >
          <Plus className="h-5 w-5" style={{ color: "var(--editor-accent)" }} />
        </div>
        <span className="text-sm" style={{ color: "var(--editor-text-dim)" }}>Create New Project</span>
      </button>
    </form>
  );
}

export function LibraryPage({
  recentProjects,
  demoProjects,
  archivedProjects,
}: {
  recentProjects: ProjectListItem[];
  demoProjects: ProjectListItem[];
  archivedProjects: ProjectListItem[];
}) {
  const [search, setSearch] = useState("");

  const allProjects = [...recentProjects, ...demoProjects];
  const filtered = search
    ? allProjects.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--editor-shell)" }}>
      {/* Header */}
      <header
        className="flex h-14 items-center justify-between border-b px-6"
        style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--editor-accent)" }}>MotionRoll</span>
        <form action={createProjectAction}>
          <input type="hidden" name="presetId" value="product-reveal" />
          <button
            type="submit"
            className="flex h-8 items-center gap-1.5 rounded px-4 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </form>
      </header>

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {/* Title + Search */}
          <div className="mb-8 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--editor-text)" }}>Projects</h1>
            <div className="relative w-72">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--editor-text-dim)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="h-10 w-full rounded-md border bg-transparent pl-10 pr-4 text-sm outline-none transition-colors focus:border-[var(--editor-accent)]"
                style={{
                  background: "var(--editor-panel)",
                  borderColor: "var(--editor-border)",
                  color: "var(--editor-text)",
                }}
              />
            </div>
          </div>

          {/* Search results */}
          {filtered ? (
            <>
              <p className="mb-4 text-sm" style={{ color: "var(--editor-text-dim)" }}>
                {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{search}"
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => (
                  <ProjectCard key={p.id} project={p} href={`/projects/${p.id}` as Route} />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Demo projects */}
              {demoProjects.length > 0 && (
                <section className="mb-10">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--editor-text-dim)" }}>
                        Demo Projects
                      </p>
                      <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--editor-text)" }}>
                        Open something visual immediately
                      </h2>
                    </div>
                    <Link
                      href="/templates"
                      className="text-sm transition-colors hover:underline"
                      style={{ color: "var(--editor-accent)" }}
                    >
                      Browse templates →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {demoProjects.map((p) => (
                      <ProjectCard key={p.id} project={p} href={`/projects/${p.id}` as Route} />
                    ))}
                  </div>
                </section>
              )}

              {/* Recent projects */}
              <section>
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--editor-text-dim)" }}>
                      Recent Projects
                    </p>
                    <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--editor-text)" }}>
                      Continue editing
                    </h2>
                  </div>
                </div>

                {recentProjects.length === 0 && demoProjects.length === 0 ? (
                  <div
                    className="rounded-lg border p-12 text-center"
                    style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
                  >
                    <p className="text-lg font-semibold" style={{ color: "var(--editor-text)" }}>No projects yet.</p>
                    <p className="mt-2 text-sm" style={{ color: "var(--editor-text-dim)" }}>
                      Create a new project or open a demo to get started.
                    </p>
                    <form action={createProjectAction} className="mt-4 inline-block">
                      <input type="hidden" name="presetId" value="product-reveal" />
                      <button
                        type="submit"
                        className="rounded px-6 py-2 text-sm font-medium"
                        style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
                      >
                        Create project
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {recentProjects.map((p) => (
                      <ProjectCard key={p.id} project={p} href={`/projects/${p.id}` as Route} />
                    ))}
                    <NewProjectCard />
                  </div>
                )}
              </section>

              {archivedProjects.length > 0 && (
                <section className="mt-10">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--editor-text-dim)" }}>
                        Archived Projects
                      </p>
                      <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--editor-text)" }}>
                        Restore work you set aside
                      </h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {archivedProjects.map((p) => (
                      <ProjectCard key={p.id} project={p} href={`/projects/${p.id}` as Route} archived />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
