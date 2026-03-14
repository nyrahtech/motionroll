"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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

export async function createProjectAction(formData: FormData) {
  const parsed = createProjectSchema.parse({
    presetId: formData.get("presetId"),
    title: formData.get("title") || undefined,
  });

  const project = await createProjectFromPreset(parsed.presetId, parsed.title);
  if (!project) {
    throw new Error("Project creation failed.");
  }
  redirect(`/projects/${project.id}`);
}
