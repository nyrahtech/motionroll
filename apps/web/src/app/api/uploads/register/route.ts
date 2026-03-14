import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { projectAssets, projects } from "@/db/schema";
import { env } from "@/lib/env";
import { LOCAL_OWNER } from "@/lib/data/local-owner";
import { createSignedUploadUrl, getStoragePublicUrl } from "@/lib/storage/s3-adapter";
import { validateVideoUpload } from "@/lib/uploads/validation";

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
  const body = registerUploadSchema.parse(await request.json());
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, body.projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found for local owner." }, { status: 404 });
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
      {
        error: error instanceof Error ? error.message : "Invalid video upload request.",
      },
      { status: 400 },
    );
  }

  const assetId = randomUUID();
  const key = `${body.projectId}/sources/${assetId}-${validatedUpload.filename}`;

  await mkdir(path.resolve(env.PROCESSING_TEMP_DIR, body.projectId), { recursive: true });

  await db.transaction(async (tx) => {
    await tx
      .update(projectAssets)
      .set({
        isPrimary: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectAssets.projectId, body.projectId),
          eq(projectAssets.ownerId, LOCAL_OWNER.id),
          eq(projectAssets.kind, "source_video"),
        ),
      );

    await tx.insert(projectAssets).values({
      id: assetId,
      projectId: body.projectId,
      ownerId: LOCAL_OWNER.id,
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
