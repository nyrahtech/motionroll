import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { aiGenerations, userProviderConnections } from "@/db/schema";
import { encryptJsonPayload } from "@/lib/ai/crypto";
import { getAiProviderAdapter } from "@/lib/ai/providers";
import { LOCAL_OWNER } from "@/lib/data/local-owner";

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
  const { provider: rawProvider } = await params;
  const provider = providerSchema.parse(rawProvider);
  const body = connectSchema.parse(await request.json());
  const adapter = getAiProviderAdapter(provider);
  const validated = await adapter.validateCredentials(body.credentials);
  const connection = await adapter.connectAccount(body);

  const [saved] = await db
    .insert(userProviderConnections)
    .values({
      userId: LOCAL_OWNER.id,
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
        : connection.metadata.unsupportedReason ?? "Validation not available in v1.",
    })
    .returning();
  if (!saved) {
    return NextResponse.json({ error: "Connection persistence failed" }, { status: 500 });
  }

  await db.insert(aiGenerations).values({
    userId: LOCAL_OWNER.id,
    providerConnectionId: saved.id,
    provider,
    status: "unsupported",
    requestPayload: {
      event: "connectAccount",
    },
    responsePayload: {
      message: connection.metadata.unsupportedReason,
    },
  });

  return NextResponse.json({
    connectionId: saved.id,
    status: saved.status,
    metadata: saved.credentialMetadata,
  });
}
