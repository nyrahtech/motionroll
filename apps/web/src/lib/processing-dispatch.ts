import type { ProcessingJobPayload } from "@motionroll/shared";
import { env } from "@/lib/env";
import { inngest } from "@/lib/inngest-client";
import { processSourceAsset } from "@/lib/processing/pipeline";

const DEFAULT_LOCAL_INNGEST_EVENT_KEY = "local-dev-key";

export function hasConfiguredInngestEventKey(eventKey = env.INNGEST_EVENT_KEY) {
  return eventKey.trim().length > 0 && eventKey !== DEFAULT_LOCAL_INNGEST_EVENT_KEY;
}

function shouldFallbackToInlineProcessing(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("event key not found") || message.includes("401");
}

export async function dispatchProcessingJob(jobId: string, payload: ProcessingJobPayload) {
  if (!hasConfiguredInngestEventKey()) {
    await processSourceAsset(jobId, payload);
    return {
      mode: "inline" as const,
    };
  }

  try {
    await inngest.send({
      name: "motionroll/process.requested",
      data: {
        jobId,
        payload,
      },
    });

    return {
      mode: "queued" as const,
    };
  } catch (error) {
    if (!shouldFallbackToInlineProcessing(error)) {
      throw error;
    }

    await processSourceAsset(jobId, payload);
    return {
      mode: "inline" as const,
    };
  }
}
