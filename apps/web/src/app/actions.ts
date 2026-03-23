"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePageAuth } from "@/lib/auth";
import { createProjectFromPreset } from "@/lib/data/projects";

const createProjectSchema = z.object({
  presetId: z.enum([
    "scroll-sequence",
    "product-reveal",
    "feature-walkthrough",
    "before-after",
    "device-spin",
    "chaptered-scroll-story",
  ]),
  title: z.string().min(1).max(128).optional(),
});

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
  const parsed = createProjectSchema.parse({
    presetId: formData.get("presetId"),
    title: formData.get("title") || undefined,
  });

  let project;
  try {
    project = await createProjectFromPreset(userId, parsed.presetId, parsed.title);
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
