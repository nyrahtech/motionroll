import { NextResponse } from "next/server";
import { z } from "zod";
import { createProjectFromPreset, getRecentProjects } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

const createProjectRequestSchema = z.object({
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

export async function GET() {
  const projects = await getRecentProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const parsed = createProjectRequestSchema.parse(await request.json());
  const project = await createProjectFromPreset(parsed.presetId, parsed.title);
  return NextResponse.json(project, { status: 201 });
}
