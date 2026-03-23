import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { PublishPanel } from "@/components/publish/publish-panel";
import { buildProjectManifest } from "@/lib/manifest";
import { getProjectById, getPublishReadiness } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export default async function PublishPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { userId } = await requirePageAuth();
  const { projectId } = await params;

  const project = await getProjectById(projectId, userId).catch(() => null);
  if (!project) {
    notFound();
  }

  const [manifest, readiness] = await Promise.all([
    buildProjectManifest(projectId, { userId }),
    getPublishReadiness(projectId, userId),
  ]);

  return (
    <PublishPanel
      project={{
        id: project.id,
        title: project.title,
        slug: project.slug,
        publishVersion: project.publishVersion,
        updatedAt: project.updatedAt.toISOString(),
      }}
      readiness={readiness}
      manifest={manifest}
    />
  );
}
