import { notFound } from "next/navigation";
import { ProjectEditorClient } from "./project-editor-client";
import { buildProjectManifest } from "@/lib/manifest";
import { getProjectById, getProjectPreset, getProjectSwitcherProjects } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectById(projectId).catch(() => null);
  const preset = await getProjectPreset(projectId).catch(() => undefined);
  const projects = await getProjectSwitcherProjects().catch(() => []);

  if (!project || !preset) {
    notFound();
  }

  const manifest = await buildProjectManifest(projectId);

  return (
    <ProjectEditorClient
      project={project}
      projects={projects}
      manifest={manifest}
      preset={preset}
    />
  );
}
