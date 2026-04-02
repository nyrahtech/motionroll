import React from "react";
import { requirePageAuth } from "@/lib/auth";
import { LibraryPage } from "@/components/library/library-page";
import { getMyProjects } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

function resolveWorkspaceNotice(workspace?: string) {
  if (workspace === "create_failed") {
    return "MotionRoll couldn't create a new project right now. Try again in a moment.";
  }
  if (workspace === "home_unavailable") {
    return "MotionRoll couldn't load your most recent project right now. You can still browse the library.";
  }
  return undefined;
}

export default async function LibraryRoute({
  searchParams,
}: {
  searchParams?: Promise<{ workspace?: string }>;
} = {}) {
  const { userId } = await requirePageAuth();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const myProjectsResult = await Promise.allSettled([getMyProjects(userId)]).then((results) => results[0]);

  const myProjects = myProjectsResult.status === "fulfilled" ? myProjectsResult.value : [];
  const workspaceDegraded = myProjectsResult.status === "rejected";

  return (
    <LibraryPage
      myProjects={myProjects}
      workspaceDegraded={workspaceDegraded}
      workspaceNotice={resolveWorkspaceNotice(resolvedSearchParams.workspace)}
    />
  );
}
