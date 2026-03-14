import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { aiGenerations, projects } from "@/db/schema";
import { getAiProviderAdapter } from "@/lib/ai/providers";
import { LOCAL_OWNER } from "@/lib/data/local-owner";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  projectId: z.string().uuid(),
  assetExternalId: z.string().min(1),
});
const providerSchema = z.enum(["runway", "luma", "sora", "other"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await params;
  const provider = providerSchema.parse(rawProvider);
  const body = importSchema.parse(await request.json());
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, body.projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found for local owner." }, { status: 404 });
  }

  const adapter = getAiProviderAdapter(provider);
  const imported = await adapter.importGeneratedAsset({
    projectId: body.projectId,
    assetExternalId: body.assetExternalId,
  });

  const [generation] = await db
    .insert(aiGenerations)
    .values({
      userId: LOCAL_OWNER.id,
      projectId: body.projectId,
      provider,
      status: "unsupported",
      requestPayload: body,
      responsePayload: imported,
      importedAssetMetadata: imported.sourceUrl
        ? {
            externalId: body.assetExternalId,
            title: `${provider} import scaffold`,
            previewUrl: imported.sourceUrl,
            metadata: {
              mimeType: "video/mp4",
              bytes: 0,
              sourceUrl: imported.sourceUrl,
            },
          }
        : null,
    })
    .returning();
  if (!generation) {
    return NextResponse.json({ error: "Import record persistence failed" }, { status: 500 });
  }

  return NextResponse.json({
    importRecorded: true,
    generationId: generation.id,
    ...imported,
  });
}
