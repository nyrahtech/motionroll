"use server";

import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { createProjectFromSource } from "@/lib/data/projects";
import { createProjectSourceSchema } from "../lib/project-creation";

function isRetryableWorkspaceFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "ECONNREFUSED",
    "connect ECONNREFUSED",
    "Failed query:",
    "timeout expired",
  ].some((marker) => error.message.includes(marker));
}

export async function createProjectAction(formData: FormData) {
  const { userId } = await requirePageAuth();
  const rawSource = formData.get("source");
  const parsedSource = createProjectSourceSchema.parse(
    typeof rawSource === "string" ? JSON.parse(rawSource) : null,
  );
  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle : undefined;

  let project;
  try {
    project = await createProjectFromSource(userId, parsedSource, title);
  } catch (error) {
    if (isRetryableWorkspaceFailure(error)) {
      redirect("/library?workspace=create_failed");
    }
    throw error;
  }

  if (!project) {
    redirect("/library?workspace=create_failed");
  }
  redirect(`/projects/${project.id}`);
}
