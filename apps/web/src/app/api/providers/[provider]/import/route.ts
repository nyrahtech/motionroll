import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { aiGenerations, projects } from "@/db/schema";
import { getAiProviderAdapter } from "@/lib/ai/providers";
import { requireAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api-utils";

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
  const { userId } = await requireAuth();
  const { provider: rawProvider } = await params;
  const providerResult = providerSchema.safeParse(rawProvider);
  if (!providerResult.success) {
    return NextResponse.json({ error: `Unknown provider: ${rawProvider}` }, { status: 400 });
  }
  const provider = providerResult.data;
  const bodyResult = await parseBody(request, importSchema);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, body.projectId), eq(projects.ownerId, userId)),
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const adapter = getAiProviderAdapter(provider);
  const imported = await adapter.importGeneratedAsset({
    projectId: body.projectId,
    assetExternalId: body.assetExternalId,
  });

  const [generation] = await db
    .insert(aiGenerations)
    .values({
      userId,
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
            metadata: { mimeType: "video/mp4", bytes: 0, sourceUrl: imported.sourceUrl },
          }
        : null,
    })
    .returning();

  if (!generation) {
    return NextResponse.json({ error: "Import record persistence failed" }, { status: 500 });
  }

  return NextResponse.json({ importRecorded: true, generationId: generation.id, ...imported });
}
