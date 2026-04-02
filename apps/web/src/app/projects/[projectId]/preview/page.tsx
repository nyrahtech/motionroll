import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/data/projects";
import { buildProjectManifest } from "@/lib/manifest";
import { PreviewExitButton } from "./preview-exit-button";
import { LocalPreviewRuntime } from "./local-preview-runtime";

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

function resolveLocalPreviewSessionId(draftSource?: string, session?: string) {
  if (draftSource !== "local") {
    return undefined;
  }
  return session;
}

export default async function ProjectPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{
    mode?: string;
    forceSequence?: string;
    embed?: string;
    draftSource?: string;
    session?: string;
  }>;
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
      <LocalPreviewRuntime
        projectId={projectId}
        fallbackManifest={manifest}
        mode={resolveRuntimeMode(resolvedSearchParams.mode)}
        forceSequence={resolveForceSequence(resolvedSearchParams.forceSequence)}
        localPreviewSessionId={resolveLocalPreviewSessionId(
          resolvedSearchParams.draftSource,
          resolvedSearchParams.session,
        )}
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
