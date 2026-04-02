import { db } from "@/db/client";
import { users } from "@/db/schema";
import type { AuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

const WORKSPACE_BOOTSTRAP_RETRY_MS = 30_000;

type FailedBootstrapState = {
  retryAfter: number;
  reason: string;
};

type WorkspaceBootstrapMode = "minimal" | "full";

type PendingWorkspaceBootstrap = {
  mode: WorkspaceBootstrapMode;
  promise: Promise<void>;
};

function modeSatisfiesBootstrap(
  completedMode: WorkspaceBootstrapMode,
  requestedMode: WorkspaceBootstrapMode,
) {
  return completedMode === "full" || completedMode === requestedMode;
}

export async function upsertWorkspaceUser(user: AuthUser) {
  await db
    .insert(users)
    .values({
      id: user.userId,
      email: user.email,
      name: user.name,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        name: user.name,
      },
    });
}

const bootstrappedUserModes = new Map<string, WorkspaceBootstrapMode>();
const pendingWorkspaceBootstraps = new Map<string, PendingWorkspaceBootstrap>();
const failedWorkspaceBootstraps = new Map<string, FailedBootstrapState>();

export async function ensureUserWorkspace(
  user: AuthUser,
  options?: { mode?: WorkspaceBootstrapMode },
): Promise<void> {
  const requestedMode = options?.mode ?? "full";
  const completedMode = bootstrappedUserModes.get(user.userId);
  if (completedMode && modeSatisfiesBootstrap(completedMode, requestedMode)) {
    return;
  }

  const currentFailure = failedWorkspaceBootstraps.get(user.userId);
  const now = Date.now();
  if (currentFailure && currentFailure.retryAfter > now) {
    return;
  }

  const pendingBootstrap = pendingWorkspaceBootstraps.get(user.userId);
  if (pendingBootstrap) {
    if (modeSatisfiesBootstrap(pendingBootstrap.mode, requestedMode)) {
      return pendingBootstrap.promise;
    }

    await pendingBootstrap.promise;
    return ensureUserWorkspace(user, options);
  }

  const bootstrapPromise = (async () => {
    try {
      await upsertWorkspaceUser(user);
      failedWorkspaceBootstraps.delete(user.userId);
      bootstrappedUserModes.set(user.userId, requestedMode);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failedWorkspaceBootstraps.set(user.userId, {
        retryAfter: Date.now() + WORKSPACE_BOOTSTRAP_RETRY_MS,
        reason,
      });
      logger.warn("Workspace bootstrap failed; using degraded project shell until retry", {
        userId: user.userId,
        retryInMs: WORKSPACE_BOOTSTRAP_RETRY_MS,
        reason,
      });
    } finally {
      pendingWorkspaceBootstraps.delete(user.userId);
    }
  })();

  pendingWorkspaceBootstraps.set(user.userId, {
    mode: requestedMode,
    promise: bootstrapPromise,
  });
  return bootstrapPromise;
}
