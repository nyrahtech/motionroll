import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { RuntimePreview } from "@/components/builder/runtime-preview";
import { db } from "@/db/client";
import { publishTargets, publishVersions } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
    <main className="mx-auto max-w-6xl py-10">
      <RuntimePreview manifest={publishedVersion.manifest} />
    </main>
  );
}
