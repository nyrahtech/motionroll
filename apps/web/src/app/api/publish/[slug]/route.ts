import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { publishTargets, publishVersions } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const target = await db.query.publishTargets.findFirst({
    where: eq(publishTargets.slug, slug),
  });

  if (!target) {
    return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
  }

  const publishedVersion = await db.query.publishVersions.findFirst({
    where: eq(publishVersions.projectId, target.projectId),
    orderBy: (versions, { desc }) => [desc(versions.version)],
  });

  if (!publishedVersion?.manifest) {
    return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
  }

  return NextResponse.json({
    manifest: publishedVersion.manifest,
    bootstrap: {
      slug: target.slug,
      targetType: target.targetType,
      version: publishedVersion.version,
    },
  });
}
