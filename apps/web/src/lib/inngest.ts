import { inngest } from "@/lib/inngest-client";
import { processSourceAsset } from "@/lib/processing/pipeline";

export { inngest };

export const processAssetRequested = inngest.createFunction(
  { id: "process-asset-requested" },
  { event: "motionroll/process.requested" },
  async ({ event }) => {
    return processSourceAsset(event.data.jobId, event.data.payload);
  },
);

export const inngestFunctions = [processAssetRequested];
