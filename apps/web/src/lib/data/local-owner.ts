import { env } from "@/lib/env";

export const LOCAL_OWNER = {
  id: env.NEXT_PUBLIC_LOCAL_OWNER_ID,
  email: env.LOCAL_OWNER_EMAIL,
  name: "Local MotionRoll Owner",
};
