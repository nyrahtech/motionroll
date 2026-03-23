import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { aiGenerations, userProviderConnections } from "@/db/schema";
import { encryptJsonPayload } from "@/lib/ai/crypto";
import { getAiProviderAdapter } from "@/lib/ai/providers";
import { requireAuth } from "@/lib/auth";
import { apiRateLimiter } from "@/lib/rate-limiter";
import { parseBody } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const connectSchema = z.object({
  accountLabel: z.string().min(1),
  credentials: z.record(z.string(), z.string()),
});
const providerSchema = z.enum(["runway", "luma", "sora", "other"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await requireAuth();
  const rl = apiRateLimiter.check(userId);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }
  const { provider: rawProvider } = await params;
  const providerResult = providerSchema.safeParse(rawProvider);
  if (!providerResult.success) {
    return NextResponse.json({ error: `Unknown provider: ${rawProvider}` }, { status: 400 });
  }
  const provider = providerResult.data;
  const bodyResult = await parseBody(request, connectSchema);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;
  const adapter = getAiProviderAdapter(provider);
  const validated = await adapter.validateCredentials(body.credentials);
  const connection = await adapter.connectAccount(body);

  const [saved] = await db
    .insert(userProviderConnections)
    .values({
      userId,
      provider,
      status: validated.valid ? "connected" : "pending_validation",
      accountLabel: body.accountLabel,
      encryptedCredentialPayload: encryptJsonPayload(body.credentials),
      credentialMetadata: {
        ...connection.metadata,
        lastValidatedAt: new Date().toISOString(),
      },
      lastError: validated.valid
        ? null
        : connection.metadata.unsupportedReason ?? "Validation not available.",
    })
    .returning();

  if (!saved) {
    return NextResponse.json({ error: "Connection persistence failed" }, { status: 500 });
  }

  await db.insert(aiGenerations).values({
    userId,
    providerConnectionId: saved.id,
    provider,
    status: "unsupported",
    requestPayload: { event: "connectAccount" },
    responsePayload: { message: connection.metadata.unsupportedReason },
  });

  return NextResponse.json({
    connectionId: saved.id,
    status: saved.status,
    metadata: saved.credentialMetadata,
  });
}
