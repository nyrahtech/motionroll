import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { ProjectEditorClient } from "./project-editor-client";
import { buildProjectManifest } from "@/lib/manifest";
import { getProjectById, getProjectPreset, getProjectSwitcherProjects } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { userId } = await requirePageAuth();
  const { projectId } = await params;

  const [project, preset, projects] = await Promise.all([
    getProjectById(projectId, userId).catch(() => null),
    getProjectPreset(projectId, userId).catch(() => undefined),
    getProjectSwitcherProjects(userId).catch(() => []),
  ]);

  if (!project || !preset) {
    notFound();
  }

  const manifest = await buildProjectManifest(projectId, { userId });

  return (
    <ProjectEditorClient
      project={project}
      projects={projects}
      manifest={manifest}
      preset={preset}
    />
  );
}
