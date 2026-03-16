import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StandaloneRuntime } from "@/components/runtime/standalone-runtime";
import { db } from "@/db/client";
import { publishTargets, publishVersions } from "@/db/schema";

export const dynamic = "force-dynamic";

function resolveRuntimeMode(mode?: string): "desktop" | "mobile" {
  return mode === "mobile" ? "mobile" : "desktop";
}

function resolveForceSequence(value?: string) {
  return value === "1" || value === "true";
}

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ mode?: string; forceSequence?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedMode = resolvedSearchParams.mode;
  const target = await db.query.publishTargets.findFirst({
    where: eq(publishTargets.slug, slug),
  });

  if (!target) {
    notFound();
  }

  const publishedVersion = await db.query.publishVersions.findFirst({
    where: eq(publishVersions.projectId, target.projectId),
    orderBy: (versions, { desc }) => [desc(versions.version)],
  });

  if (!publishedVersion?.manifest) {
    notFound();
  }

  return (
    <main className="bg-black">
      <StandaloneRuntime
        manifest={publishedVersion.manifest}
        mode={resolveRuntimeMode(requestedMode)}
        forceSequence={resolveForceSequence(resolvedSearchParams.forceSequence)}
      />
    </main>
  );
}
