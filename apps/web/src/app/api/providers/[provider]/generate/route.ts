/**
 * POST /api/providers/[provider]/generate
 *
 * Submits a generation request to the AI provider and records it in aiGenerations.
 * A polling Inngest job is triggered to track the result.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { aiGenerations, projects, userProviderConnections } from "@/db/schema";
import { decryptJsonPayload } from "@/lib/ai/crypto";
import { requireAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api-utils";
import { inngest } from "@/lib/inngest-client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const providerSchema = z.enum(["runway", "luma", "sora", "other"]);

const generateSchema = z.object({
  projectId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(2000),
  durationSeconds: z.number().min(3).max(30).default(6),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  connectionId: z.string().uuid(),
});

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

  const bodyResult = await parseBody(request, generateSchema);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;

  if (body.projectId) {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, body.projectId), eq(projects.ownerId, userId)),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
  }

  // Look up the provider connection to get credentials
  const connection = await db.query.userProviderConnections.findFirst({
    where: and(
      eq(userProviderConnections.id, body.connectionId),
      eq(userProviderConnections.userId, userId),
      eq(userProviderConnections.provider, provider),
    ),
  });

  if (!connection) {
    return NextResponse.json({ error: "Provider connection not found." }, { status: 404 });
  }

  if (connection.status !== "connected") {
    return NextResponse.json(
      { error: "Provider not connected. Validate your credentials first." },
      { status: 400 },
    );
  }

  // Decrypt credentials
  let credentials: Record<string, string>;
  try {
    credentials = decryptJsonPayload(connection.encryptedCredentialPayload) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "Failed to decrypt provider credentials." }, { status: 500 });
  }

  // Submit generation to provider API
  let externalGenerationId: string | null = null;
  let submitError: string | null = null;

  if (provider === "runway") {
    const apiKey = credentials.apiKey ?? credentials.RUNWAYML_API_SECRET;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing Runway API key in stored credentials." }, { status: 400 });
    }
    try {
      const res = await fetch("https://api.runwayml.com/v1/text_to_video", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06",
        },
        body: JSON.stringify({
          promptText: body.prompt,
          duration: body.durationSeconds,
          ratio: body.aspectRatio === "16:9" ? "1280:720" : body.aspectRatio === "9:16" ? "720:1280" : "1024:1024",
          model: "gen4_turbo",
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json() as { id?: string };
        externalGenerationId = data.id ?? null;
      } else {
        const errText = await res.text().catch(() => res.statusText);
        submitError = `Runway API error ${res.status}: ${errText}`;
        logger.warn("Runway generation submit failed", { status: res.status, userId });
      }
    } catch (err) {
      submitError = `Network error reaching Runway: ${err instanceof Error ? err.message : "unknown"}`;
      logger.error("Runway generation network error", { error: submitError, userId });
    }
  } else if (provider === "luma") {
    const apiKey = credentials.apiKey ?? credentials.LUMAAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing Luma API key in stored credentials." }, { status: 400 });
    }
    try {
      const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prompt: body.prompt,
          aspect_ratio: body.aspectRatio,
          loop: false,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json() as { id?: string };
        externalGenerationId = data.id ?? null;
      } else {
        const errText = await res.text().catch(() => res.statusText);
        submitError = `Luma API error ${res.status}: ${errText}`;
        logger.warn("Luma generation submit failed", { status: res.status, userId });
      }
    } catch (err) {
      submitError = `Network error reaching Luma: ${err instanceof Error ? err.message : "unknown"}`;
    }
  } else {
    // sora / other: record stub
    submitError = `Live generation not yet implemented for ${provider}.`;
  }

  // Record the generation in DB
  const [generation] = await db
    .insert(aiGenerations)
    .values({
      userId,
      projectId: body.projectId ?? null,
      providerConnectionId: connection.id,
      provider,
      externalGenerationId,
      status: externalGenerationId ? "running" : "failed",
      promptText: body.prompt,
      requestPayload: body,
      responsePayload: submitError ? { error: submitError } : { externalId: externalGenerationId },
      failureReason: submitError ?? null,
    })
    .returning();

  if (!generation) {
    return NextResponse.json({ error: "Failed to record generation." }, { status: 500 });
  }

  // Kick off polling if we have an external ID
  if (externalGenerationId) {
    await inngest.send({
      name: "motionroll/provider.generation.poll",
      data: {
        generationId: generation.id,
        externalGenerationId,
        provider,
        connectionId: connection.id,
        userId,
        projectId: body.projectId ?? null,
      },
    });
  }

  return NextResponse.json({
    generationId: generation.id,
    externalGenerationId,
    status: generation.status,
    message: submitError ?? `Generation submitted to ${provider}.`,
  });
}
