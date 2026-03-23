/**
 * GET /api/providers/[provider]/assets
 *
 * Returns completed and in-progress AI generations for the authenticated user,
 * filtered by provider. Completed generations with an outputUrl are ready to import.
 */
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { aiGenerations } from "@/db/schema";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const providerSchema = z.enum(["runway", "luma", "sora", "other"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await requireAuth();
  const { provider: rawProvider } = await params;

  const providerResult = providerSchema.safeParse(rawProvider);
  if (!providerResult.success) {
    return NextResponse.json({ error: `Unknown provider: ${rawProvider}` }, { status: 400 });
  }
  const provider = providerResult.data;

  const generations = await db.query.aiGenerations.findMany({
    where: and(
      eq(aiGenerations.userId, userId),
      eq(aiGenerations.provider, provider),
    ),
    orderBy: [desc(aiGenerations.createdAt)],
    limit: 50,
  });

  const assets = generations
    .filter((g) => g.status !== "unsupported")
    .map((g) => ({
      externalId: g.externalGenerationId ?? g.id,
      generationId: g.id,
      title: g.promptText
        ? `${g.promptText.slice(0, 60)}${g.promptText.length > 60 ? "..." : ""}`
        : `${provider} generation`,
      previewUrl: g.outputUrl ?? g.importedAssetMetadata?.previewUrl ?? null,
      status: g.status,
      createdAt: g.createdAt.toISOString(),
      canImport: g.status === "completed" && Boolean(g.outputUrl),
    }));

  return NextResponse.json({ provider, assets });
}
