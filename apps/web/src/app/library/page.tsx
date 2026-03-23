import React from "react";
import { requirePageAuth } from "@/lib/auth";
import { LibraryPage } from "@/components/library/library-page";
import { getArchivedProjects, getDemoProjects, getRecentProjects } from "@/lib/data/projects";

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
  const [recentProjectsResult, demoProjectsResult, archivedProjectsResult] = await Promise.allSettled([
    getRecentProjects(userId),
    getDemoProjects(userId),
    getArchivedProjects(userId),
  ]);

  const recentProjects =
    recentProjectsResult.status === "fulfilled" ? recentProjectsResult.value : [];
  const demoProjects =
    demoProjectsResult.status === "fulfilled" ? demoProjectsResult.value : [];
  const archivedProjects =
    archivedProjectsResult.status === "fulfilled" ? archivedProjectsResult.value : [];
  const workspaceDegraded =
    recentProjectsResult.status === "rejected" ||
    demoProjectsResult.status === "rejected" ||
    archivedProjectsResult.status === "rejected";

  return (
    <LibraryPage
      recentProjects={recentProjects}
      demoProjects={demoProjects}
      archivedProjects={archivedProjects}
      workspaceDegraded={workspaceDegraded}
      workspaceNotice={resolveWorkspaceNotice(resolvedSearchParams.workspace)}
    />
  );
}
