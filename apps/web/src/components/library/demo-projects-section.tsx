"use client";

import { demoProjects, featuredDemoProject, type DemoProjectDefinition } from "@/lib/demo-projects";
import { DemoProjectCard } from "./demo-project-card";
import { FeaturedDemoProjectCard } from "./featured-demo-project-card";

export function DemoProjectsSection({
  startingDemoId,
  onStartEditing,
}: {
  startingDemoId: string | null;
  onStartEditing: (project: DemoProjectDefinition) => void;
}) {
  const secondaryProjects = demoProjects.filter(
    (project) => project.id === "product-reveal" || project.id === "product-spin",
  );

  return (
    <section>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: "var(--editor-text-dim)" }}>
            Explore Examples
          </p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: "var(--editor-text)" }}>
            Browse polished ideas before you create
          </h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
            Curated demos to explore styles and interactions.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.38fr)_minmax(320px,0.92fr)] xl:items-stretch">
        {featuredDemoProject ? (
          <FeaturedDemoProjectCard
            project={featuredDemoProject}
            isStarting={startingDemoId === featuredDemoProject.id}
            onStartEditing={onStartEditing}
          />
        ) : null}

        {secondaryProjects.length > 0 ? (
          <div className="grid gap-4 content-start xl:h-full xl:grid-rows-2">
            {secondaryProjects.map((project) => (
              <DemoProjectCard
                key={project.id}
                project={project}
                isStarting={startingDemoId === project.id}
                onStartEditing={onStartEditing}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
