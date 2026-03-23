/**
 * providerGenerationPoll — Inngest function that polls provider APIs
 * for generation completion and downloads the result to storage.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiGenerations, userProviderConnections } from "@/db/schema";
import { decryptJsonPayload } from "@/lib/ai/crypto";
import { inngest } from "@/lib/inngest-client";
import { uploadBuffer } from "@/lib/storage/s3-adapter";

import { logger } from "@/lib/logger";

const MAX_POLLS = 60; // 10 min at 10s intervals

export const providerGenerationPoll = inngest.createFunction(
  {
    id: "provider-generation-poll",
    retries: 0,
    timeouts: { finish: "12m" },
  },
  { event: "motionroll/provider.generation.poll" },
  async ({ event, step }) => {
    const { generationId, externalGenerationId, provider, connectionId, userId } = event.data as {
      generationId: string;
      externalGenerationId: string;
      provider: "runway" | "luma" | "sora" | "other";
      connectionId: string;
      userId: string;
    };

    // Get credentials
    const connection = await step.run("get-connection", async () => {
      return db.query.userProviderConnections.findFirst({
        where: eq(userProviderConnections.id, connectionId),
      });
    });

    if (!connection) {
      await db.update(aiGenerations)
        .set({ status: "failed", failureReason: "Provider connection not found", updatedAt: new Date() })
        .where(eq(aiGenerations.id, generationId));
      return { status: "failed", reason: "connection_not_found" };
    }

    let credentials: Record<string, string>;
    try {
      credentials = decryptJsonPayload(connection.encryptedCredentialPayload) as Record<string, string>;
    } catch {
      return { status: "failed", reason: "credential_decrypt_failed" };
    }

    // Poll loop
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await step.sleep(`poll-wait-${poll}`, "10s");

      const result = await step.run(`poll-${poll}`, async () => {
        if (provider === "runway") {
          const apiKey = credentials.apiKey ?? credentials.RUNWAYML_API_SECRET;
          const res = await fetch(`https://api.runwayml.com/v1/tasks/${externalGenerationId}`, {
            headers: { Authorization: `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return { state: "error", reason: `HTTP ${res.status}` };
          const data = await res.json() as { status?: string; output?: string[] };
          const status = data.status?.toUpperCase();
          if (status === "SUCCEEDED") return { state: "completed", outputUrl: data.output?.[0] ?? null };
          if (status === "FAILED" || status === "CANCELLED") return { state: "failed", reason: `Runway status: ${status}` };
          return { state: "running" };
        }

        if (provider === "luma") {
          const apiKey = credentials.apiKey ?? credentials.LUMAAI_API_KEY;
          const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${externalGenerationId}`, {
            headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return { state: "error", reason: `HTTP ${res.status}` };
          const data = await res.json() as { state?: string; assets?: { video?: string } };
          if (data.state === "completed") return { state: "completed", outputUrl: data.assets?.video ?? null };
          if (data.state === "failed") return { state: "failed", reason: "Luma generation failed" };
          return { state: "running" };
        }

        return { state: "unsupported" };
      });

      if (result.state === "unsupported") {
        await db.update(aiGenerations)
          .set({ status: "unsupported", updatedAt: new Date() })
          .where(eq(aiGenerations.id, generationId));
        return { status: "unsupported" };
      }

      if (result.state === "completed" && "outputUrl" in result && result.outputUrl) {
        // Download and store the output video
        const outputUrl = result.outputUrl as string;
        await step.run("download-and-store", async () => {
          try {
            const videoRes = await fetch(outputUrl, { signal: AbortSignal.timeout(60000) });
            if (!videoRes.ok) throw new Error(`Download failed: HTTP ${videoRes.status}`);
            const buffer = Buffer.from(await videoRes.arrayBuffer());
            const storageKey = `${userId}/ai-imports/${generationId}/source.mp4`;
            const uploaded = await uploadBuffer(storageKey, buffer, "video/mp4");

            await db.update(aiGenerations)
              .set({
                status: "completed",
                outputUrl: uploaded.publicUrl,
                updatedAt: new Date(),
              })
              .where(eq(aiGenerations.id, generationId));

            // Generation stored — user can import from the provider panel

            logger.info("Provider generation downloaded and stored", { generationId, provider, userId });
          } catch (err) {
            logger.error("Generation download failed", {
              generationId,
              error: err instanceof Error ? err.message : String(err),
            });
            await db.update(aiGenerations)
              .set({ status: "failed", failureReason: "Download failed", updatedAt: new Date() })
              .where(eq(aiGenerations.id, generationId));
          }
        });
        return { status: "completed", generationId };
      }

      if (result.state === "failed" || result.state === "error") {
        const failureReason = "reason" in result ? result.reason : "Unknown failure";
        await db.update(aiGenerations)
          .set({ status: "failed", failureReason, updatedAt: new Date() })
          .where(eq(aiGenerations.id, generationId));
        return { status: "failed", reason: failureReason };
      }
    }

    // Timed out
    await db.update(aiGenerations)
      .set({ status: "failed", failureReason: "Generation timed out after 10 minutes", updatedAt: new Date() })
      .where(eq(aiGenerations.id, generationId));
    return { status: "failed", reason: "timeout" };
  },
);
