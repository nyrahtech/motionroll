import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { StandaloneRuntime } from "@/components/runtime/standalone-runtime";
import { getProjectById } from "@/lib/data/projects";
import { buildProjectManifest } from "@/lib/manifest";
import { PreviewExitButton } from "./preview-exit-button";

export const dynamic = "force-dynamic";

function resolveRuntimeMode(mode?: string): "desktop" | "mobile" {
  return mode === "mobile" ? "mobile" : "desktop";
}

function resolveForceSequence(value?: string) {
  return value === "1" || value === "true";
}

function resolveEmbeddedPreview(value?: string) {
  return value === "1" || value === "true";
}

export default async function ProjectPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ mode?: string; forceSequence?: string; embed?: string }>;
}) {
  const { userId } = await requirePageAuth();
  const { projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const project = await getProjectById(projectId, userId).catch(() => null);
  if (!project) {
    notFound();
  }

  const manifest = await buildProjectManifest(projectId, { userId }).catch(() => null);
  if (!manifest) {
    notFound();
  }

  return (
    <main className="bg-black">
      <StandaloneRuntime
        manifest={manifest}
        mode={resolveRuntimeMode(resolvedSearchParams.mode)}
        reducedMotion={false}
        forceSequence={resolveForceSequence(resolvedSearchParams.forceSequence)}
      />
      {resolveEmbeddedPreview(resolvedSearchParams.embed) ? null : (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)", paddingTop: 48 }}
        >
          <PreviewExitButton projectId={projectId} />
        </div>
      )}
    </main>
  );
}
