import { getCurrentUser } from "@/lib/auth";
import { ensureUserWorkspace } from "./workspace-bootstrap";

/**
 * Ensures the signed-in user has a real workspace row.
 */
export async function ensureUserWorkspaceById(
  userId: string,
  options?: { mode?: "minimal" | "full" },
): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.userId !== userId) {
    return;
  }

  await ensureUserWorkspace(currentUser, options);
}
