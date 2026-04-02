"use client";

import type { Route } from "next";
import { NewProjectCard } from "./new-project-card";
import { ProjectCard } from "./project-card";
import type { LibraryProjectListItem } from "./types";

export function MyProjectsSection({
  projects,
  workspaceDegraded,
  isCreatingProject,
  onCreateProject,
}: {
  projects: LibraryProjectListItem[];
  workspaceDegraded: boolean;
  isCreatingProject: boolean;
  onCreateProject: () => void;
}) {
  return (
    <section className="mt-20 md:mt-24">
      <div className="mb-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: "var(--editor-text-dim)" }}>
            Your Projects
          </p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: "var(--editor-text)" }}>
            Continue your work
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
            Open a project or start from scratch.
          </p>
        </div>
      </div>

      {workspaceDegraded ? (
        <div
          className="rounded-[var(--radius-lg)] border px-6 py-8"
          style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--editor-text)" }}>
            Your Projects are temporarily unavailable.
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--editor-text-dim)" }}>
            You can still open a demo and try again in a moment.
          </p>
        </div>
      ) : null}

      {!workspaceDegraded ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <NewProjectCard isCreating={isCreatingProject} onCreate={onCreateProject} />
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              href={`/projects/${project.id}` as Route}
              prioritizeImage={index < 2}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
