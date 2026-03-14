"use client";

import * as Popover from "@radix-ui/react-popover";
import { Archive, ChevronDown, Copy, FolderOpen, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SwitcherProject = {
  id: string;
  title: string;
  slug: string;
  status: string;
  lastOpenedAt?: Date | string | null;
  lastPublishedAt?: Date | string | null;
  publishTargets?: Array<{
    targetType: string;
    slug: string;
    isReady: boolean;
    version: number;
    publishedAt: Date | null;
  }>;
};

export function ProjectSwitcher({
  currentProjectId,
  currentProjectTitle,
  projects,
}: {
  currentProjectId: string;
  currentProjectTitle: string;
  projects: SwitcherProject[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [renameValue, setRenameValue] = useState(currentProjectTitle);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return projects;
    }

    return projects.filter((project) =>
      `${project.title} ${project.slug}`.toLowerCase().includes(normalized),
    );
  }, [projects, query]);

  async function renameCurrentProject() {
    const nextTitle = renameValue.trim();
    if (!nextTitle || nextTitle === currentProjectTitle) {
      return;
    }

    setPendingAction("rename");
    await fetch(`/api/projects/${currentProjectId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: nextTitle }),
    });
    window.location.reload();
  }

  async function duplicateCurrentProject() {
    setPendingAction("duplicate");
    const response = await fetch(`/api/projects/${currentProjectId}/duplicate`, {
      method: "POST",
    });
    if (!response.ok) {
      setPendingAction(null);
      return;
    }
    const project = (await response.json()) as { id: string };
    window.location.assign(`/projects/${project.id}`);
  }

  async function archiveCurrentProject() {
    setPendingAction("archive");
    await fetch(`/api/projects/${currentProjectId}/archive`, {
      method: "POST",
    });
    window.location.assign("/library");
  }

  async function createProject(title: string) {
    setPendingAction("create");
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        presetId: "scroll-sequence",
        title,
      }),
    });
    if (!response.ok) {
      setPendingAction(null);
      return;
    }
    const project = (await response.json()) as { id: string };
    window.location.assign(`/projects/${project.id}`);
  }

  const trigger = (
    <button
      type="button"
      className="focus-ring inline-flex max-w-[320px] cursor-pointer items-center gap-2 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 text-sm text-white transition hover:border-[rgba(205,239,255,0.18)] hover:bg-[rgba(205,239,255,0.06)]"
    >
      <span className="truncate">{currentProjectTitle}</span>
      <ChevronDown className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
    </button>
  );

  if (!mounted) {
    return trigger;
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={10}
          align="start"
          className="z-[60] w-[360px] rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[#0b0e14] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.34)]"
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
                Project switcher
              </p>
              <label className="focus-ring flex items-center gap-2 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.03)] px-3">
                <Search className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects"
                  className="h-9 w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-[var(--foreground-faint)]"
                />
              </label>
            </div>

            <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
              {filteredProjects.map((project) => {
                const published = project.publishTargets?.find((target) => target.targetType === "hosted_embed");
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => window.location.assign(`/projects/${project.id}`)}
                    className={`focus-ring flex w-full cursor-pointer items-center justify-between rounded-[10px] px-3 py-2 text-left transition ${
                      project.id === currentProjectId
                        ? "bg-[rgba(205,239,255,0.12)]"
                        : "bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{project.title}</p>
                      <p className="truncate text-xs text-[var(--foreground-faint)]">
                        {project.slug}
                      </p>
                    </div>
                    <Badge variant={published?.publishedAt ? "accent" : "quiet"}>
                      {published?.publishedAt ? "Published" : "Draft"}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="section-divider" />

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
                Current project
              </p>
              <div className="flex gap-2">
                <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pendingAction === "rename"}
                  onClick={() => void renameCurrentProject()}
                >
                  {pendingAction === "rename" ? "Saving…" : "Rename"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void duplicateCurrentProject()}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void archiveCurrentProject()}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </Button>
                <Button asChild type="button" variant="quiet" size="sm">
                  <a href="/library">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open library
                  </a>
                </Button>
              </div>
            </div>

            <div className="section-divider" />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={Boolean(pendingAction)}
                onClick={() => void createProject(`Project ${new Date().toLocaleDateString("en", { month: "short", day: "numeric" })}`)}
              >
                <Plus className="h-3.5 w-3.5" />
                New blank
              </Button>
              <Button asChild type="button" variant="quiet" size="sm">
                <a href="/templates">
                  <Copy className="h-3.5 w-3.5" />
                  Browse templates
                </a>
              </Button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
