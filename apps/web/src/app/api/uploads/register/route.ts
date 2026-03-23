import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { projectAssets, projects } from "@/db/schema";
import { env } from "@/lib/env";
import { requireAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api-utils";
import { createSignedUploadUrl, getStoragePublicUrl } from "@/lib/storage/s3-adapter";
import { validateVideoUpload } from "@/lib/uploads/validation";
import { uploadRateLimiter, getClientIdentifier } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

const registerUploadSchema = z.object({
  projectId: z.string().uuid(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  bytes: z.number().int().positive(),
  sourceType: z.literal("video"),
  sourceOrigin: z.literal("upload").default("upload"),
  retentionPolicy: z.enum(["delete_after_success", "keep_source"]).optional(),
});

export async function POST(request: Request) {
  const { userId } = await requireAuth();

  // Rate limit: 10 upload registrations per minute per user
  const { ok, resetAt } = uploadRateLimiter.check(userId);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before uploading again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const bodyResult = await parseBody(request, registerUploadSchema);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, body.projectId), eq(projects.ownerId, userId)),
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let validatedUpload: ReturnType<typeof validateVideoUpload>;
  try {
    validatedUpload = validateVideoUpload({
      filename: body.filename,
      contentType: body.contentType,
      bytes: body.bytes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid video upload request." },
      { status: 400 },
    );
  }

  const assetId = randomUUID();
  const key = `${body.projectId}/sources/${assetId}-${validatedUpload.filename}`;

  await mkdir(path.resolve(env.PROCESSING_TEMP_DIR, body.projectId), { recursive: true });

  await db.transaction(async (tx) => {
    await tx
      .update(projectAssets)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(projectAssets.projectId, body.projectId),
          eq(projectAssets.ownerId, userId),
          eq(projectAssets.kind, "source_video"),
        ),
      );

    await tx.insert(projectAssets).values({
      id: assetId,
      projectId: body.projectId,
      ownerId: userId,
      kind: "source_video",
      sourceType: "video",
      sourceOrigin: "upload",
      storageKey: key,
      publicUrl: getStoragePublicUrl(key),
      metadata: {
        mimeType: validatedUpload.contentType,
        bytes: validatedUpload.bytes,
        originalFilename: validatedUpload.filename,
        uploadValidatedAt: new Date().toISOString(),
      },
      isPrimary: true,
    });
  });

  const uploadUrl = await createSignedUploadUrl(key, validatedUpload.contentType);

  return NextResponse.json({
    assetId,
    storageKey: key,
    uploadUrl,
    next: {
      method: "POST",
      url: `/api/projects/${body.projectId}`,
      body: {
        action: "enqueue_processing",
        assetId,
        retentionPolicy: body.retentionPolicy ?? env.SOURCE_RETENTION_DEFAULT,
        sourceType: "video",
        sourceOrigin: "upload",
      },
    },
  });
}
