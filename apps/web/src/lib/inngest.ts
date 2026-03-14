import { Inngest } from "inngest";
import { env } from "@/lib/env";
import { processSourceAsset } from "@/lib/processing/pipeline";

export const inngest = new Inngest({
  id: "motionroll",
  name: "MotionRoll",
  eventKey: env.INNGEST_EVENT_KEY,
});

export const processAssetRequested = inngest.createFunction(
  { id: "process-asset-requested" },
  { event: "motionroll/process.requested" },
  async ({ event }) => {
    return processSourceAsset(event.data.jobId, event.data.payload);
  },
);

export const inngestFunctions = [processAssetRequested];
