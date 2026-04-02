"use client";

import * as Popover from "@radix-ui/react-popover";
import { Archive, ChevronDown, Copy, FolderOpen, Plus, Search, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectSettingsModal } from "./project-settings-modal";

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
  bookmarkTitle,
  frameRangeStart,
  frameRangeEnd,
  scrubStrength,
  sectionHeightVh,
  currentProjectCoverUrl,
  hasThumbnailOverride,
  projects,
  open,
  onOpenChange,
  onSaveSettings,
  onThumbnailUpload,
  onThumbnailReset,
}: {
  currentProjectId: string;
  currentProjectTitle: string;
  bookmarkTitle: string;
  frameRangeStart: number;
  frameRangeEnd: number;
  scrubStrength: number;
  sectionHeightVh: number;
  currentProjectCoverUrl: string;
  hasThumbnailOverride: boolean;
  projects: SwitcherProject[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaveSettings: (values: {
    projectTitle: string;
    bookmarkTitle: string;
    frameRangeStart: number;
    frameRangeEnd: number;
    scrubStrength: number;
    sectionHeightVh: number;
  }) => Promise<void> | void;
  onThumbnailUpload: (file: File) => Promise<void>;
  onThumbnailReset: () => Promise<void>;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const resolvedOpen = open ?? uncontrolledOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

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
        source: { kind: "blank" },
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
      aria-label="Open project switcher"
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
    <>
      <Popover.Root open={resolvedOpen} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={10}
            align="start"
            className="z-[60] w-[360px] rounded-[14px] border p-3 shadow-[0_24px_48px_rgba(0,0,0,0.34)]"
            style={{
              background: "var(--editor-panel)",
              borderColor: "var(--editor-border)",
              color: "var(--editor-text)",
            }}
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

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    setIsSettingsOpen(true);
                    handleOpenChange(false);
                  }}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Project settings
                </Button>
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void createProject(`Project ${new Date().toLocaleDateString("en", { month: "short", day: "numeric" })}`)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Project
                </Button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <ProjectSettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        values={{
          projectTitle: currentProjectTitle,
          bookmarkTitle,
          frameRangeStart,
          frameRangeEnd,
          scrubStrength,
          sectionHeightVh,
        }}
        coverUrl={currentProjectCoverUrl}
        hasThumbnailOverride={hasThumbnailOverride}
        onSave={onSaveSettings}
        onThumbnailUpload={onThumbnailUpload}
        onThumbnailReset={onThumbnailReset}
      />
    </>
  );
}
