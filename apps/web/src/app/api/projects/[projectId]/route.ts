import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  processingJobs,
  projectAssets,
  projects,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api-utils";
import { getProjectById, renameProject } from "@/lib/data/projects";
import { env } from "@/lib/env";
import { getSourceAssetValidationError } from "@/lib/project-assets";
import { dispatchProcessingJob } from "@/lib/processing-dispatch";

export const dynamic = "force-dynamic";

const updateProjectSchema = z.object({
  title: z.string().min(1),
});

const enqueueSchema = z.object({
  action: z.literal("enqueue_processing"),
  assetId: z.string().uuid(),
  retentionPolicy: z.enum(["delete_after_success", "keep_source"]).default("delete_after_success"),
  sourceType: z.enum(["video", "ai_clip"]),
  sourceOrigin: z.enum(["upload", "ai_import"]).default("upload"),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const project = await getProjectById(projectId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const project = await getProjectById(projectId, userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.update(projects)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const bodyResult = await parseBody(request, updateProjectSchema);
  if (bodyResult.error) return bodyResult.error;
  const updatedProject = await renameProject(
    projectId,
    userId,
    bodyResult.data.title.trim(),
  );
  if (!updatedProject) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, project: updatedProject });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const bodyResult = await parseBody(request, enqueueSchema);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;

  const asset = await db.query.projectAssets.findFirst({
    where: and(eq(projectAssets.id, body.assetId), eq(projectAssets.projectId, projectId), eq(projectAssets.ownerId, userId)),
  });

  const assetError = getSourceAssetValidationError({
    asset,
    projectId,
    sourceType: body.sourceType,
    sourceOrigin: body.sourceOrigin,
    maxBytes: env.UPLOAD_MAX_VIDEO_BYTES,
  });

  if (assetError) {
    return NextResponse.json({ error: assetError }, { status: assetError === "Asset not found for project." ? 404 : 400 });
  }

  const [job] = await db.insert(processingJobs).values({
    projectId,
    assetId: body.assetId,
    payload: {
      projectId,
      assetId: body.assetId,
      sourceType: body.sourceType,
      sourceOrigin: body.sourceOrigin,
      retentionPolicy: body.retentionPolicy ?? env.SOURCE_RETENTION_DEFAULT,
      outputTargets: ["frames", "poster", "fallback_video", "manifest_fragment"],
    },
  }).returning();

  if (!job) return NextResponse.json({ error: "Job creation failed" }, { status: 500 });

  const dispatch = await dispatchProcessingJob(job.id, job.payload);

  return NextResponse.json({ ok: true, jobId: job.id, assetId: body.assetId, processingMode: dispatch.mode });
}
