import { Inngest } from "inngest";
import { env } from "@/lib/env";

export const inngest = new Inngest({
  id: "motionroll",
  name: "MotionRoll",
  eventKey: env.INNGEST_EVENT_KEY,
});
