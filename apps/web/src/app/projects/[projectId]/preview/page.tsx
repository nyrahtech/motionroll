import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { StandaloneRuntime } from "@/components/runtime/standalone-runtime";
import { getProjectById } from "@/lib/data/projects";
import { buildProjectManifest } from "@/lib/manifest";

export const dynamic = "force-dynamic";

function resolveRuntimeMode(mode?: string): "desktop" | "mobile" {
  return mode === "mobile" ? "mobile" : "desktop";
}

function resolveForceSequence(value?: string) {
  return value === "1" || value === "true";
}

export default async function ProjectPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ mode?: string; forceSequence?: string }>;
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
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-6"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)", paddingTop: 48 }}
      >
        <button
          type="button"
          className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/40"
          style={{ background: "rgba(10,12,18,0.88)", borderColor: "rgba(255,255,255,0.16)" }}
          onClick={() => window.close()}
        >
          &lt;- Exit preview
        </button>
      </div>
    </main>
  );
}
