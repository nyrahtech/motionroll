"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { demoProjects, type DemoProjectDefinition } from "@/lib/demo-projects";
import { WorkspaceDegradedBanner } from "@/components/app/workspace-degraded-banner";
import { DemoProjectsSection } from "./demo-projects-section";
import { LibraryHeader } from "./library-header";
import { MyProjectsSection } from "./my-projects-section";
import { ProjectSearch } from "./project-search";
import type { LibraryProjectListItem } from "./types";

async function readJsonError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({ error: fallback }))) as {
    error?: string;
  };
  return data.error ?? fallback;
}

async function createProject(request: {
  source: { kind: "blank" } | { kind: "demo"; demoId: string };
  title?: string;
}) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readJsonError(response, "Project creation failed."));
  }

  return (await response.json()) as { id?: string };
}

export function LibraryPage({
  myProjects,
  workspaceDegraded = false,
  workspaceNotice,
}: {
  myProjects: LibraryProjectListItem[];
  workspaceDegraded?: boolean;
  workspaceNotice?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreatingBlankProject, setIsCreatingBlankProject] = useState(false);
  const [startingDemoId, setStartingDemoId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return myProjects;
    }

    return myProjects.filter((project) => project.title.toLowerCase().includes(query));
  }, [myProjects, search]);

  const handleCreateBlankProject = useCallback(async () => {
    if (isCreatingBlankProject) {
      return;
    }

    setIsCreatingBlankProject(true);
    try {
      const project = await createProject({
        source: { kind: "blank" },
      });

      if (!project.id) {
        throw new Error("Project creation failed.");
      }

      window.location.assign(`/projects/${project.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project creation failed.";
      if (message.includes("temporarily unavailable")) {
        router.replace("/library?workspace=create_failed");
        router.refresh();
      }
      toast.error(message);
      setIsCreatingBlankProject(false);
    }
  }, [isCreatingBlankProject, router]);

  const handleStartEditingDemo = useCallback(async (project: DemoProjectDefinition) => {
    if (startingDemoId) {
      return;
    }

    setStartingDemoId(project.id);
    try {
      const createdProject = await createProject({
        source: { kind: "demo", demoId: project.id },
      });

      if (!createdProject.id) {
        throw new Error("Project creation failed.");
      }

      window.location.assign(`/projects/${createdProject.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project creation failed.");
      setStartingDemoId(null);
    }
  }, [startingDemoId]);

  return (
    <div className="min-h-screen" style={{ background: "var(--editor-shell)" }}>
      <LibraryHeader isCreating={isCreatingBlankProject} onCreate={() => void handleCreateBlankProject()} />

      <main className="px-6 py-10 md:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold" style={{ color: "var(--editor-text)" }}>
                Projects
              </h1>
              <p className="mt-3 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
                Start with an example or continue your work.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <ProjectSearch value={search} onChange={setSearch} className="max-w-none" />
            </div>
          </div>

          {workspaceNotice ? <WorkspaceDegradedBanner message={workspaceNotice} /> : null}
          {workspaceDegraded ? <WorkspaceDegradedBanner /> : null}

          {demoProjects.length > 0 ? (
            <DemoProjectsSection
              startingDemoId={startingDemoId}
              onStartEditing={(project) => void handleStartEditingDemo(project)}
            />
          ) : null}

          <MyProjectsSection
            projects={filteredProjects}
            workspaceDegraded={workspaceDegraded}
            isCreatingProject={isCreatingBlankProject}
            onCreateProject={() => void handleCreateBlankProject()}
          />
        </div>
      </main>
    </div>
  );
}
