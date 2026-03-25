import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { projectAssets, projects } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { deleteStorageObject, getStoragePublicUrl, uploadBuffer } from "@/lib/storage/s3-adapter";
import { validateImageUpload } from "@/lib/uploads/validation";

export const dynamic = "force-dynamic";

async function getOwnedProject(projectId: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const project = await getOwnedProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thumbnail file is required." }, { status: 400 });
  }

  let validatedUpload: ReturnType<typeof validateImageUpload>;
  try {
    validatedUpload = validateImageUpload({
      filename: file.name,
      contentType: file.type,
      bytes: file.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid thumbnail upload." },
      { status: 400 },
    );
  }

  const assetId = randomUUID();
  const key = `${projectId}/thumbnail/${assetId}-${validatedUpload.filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadBuffer(key, buffer, validatedUpload.contentType);

  const existingThumbnails = await db.query.projectAssets.findMany({
    where: and(
      eq(projectAssets.projectId, projectId),
      eq(projectAssets.ownerId, userId),
      eq(projectAssets.kind, "thumbnail"),
    ),
  });

  await db.transaction(async (tx) => {
    if (existingThumbnails.length > 0) {
      await tx
        .delete(projectAssets)
        .where(
          and(
            eq(projectAssets.projectId, projectId),
            eq(projectAssets.ownerId, userId),
            eq(projectAssets.kind, "thumbnail"),
          ),
        );
    }

    await tx.insert(projectAssets).values({
      id: assetId,
      projectId,
      ownerId: userId,
      kind: "thumbnail",
      storageKey: uploaded.key,
      publicUrl: uploaded.publicUrl,
      metadata: {
        mimeType: validatedUpload.contentType,
        bytes: validatedUpload.bytes,
        originalFilename: validatedUpload.filename,
        uploadedAt: new Date().toISOString(),
      },
    });
  });

  await Promise.all(
    existingThumbnails.map((asset) => deleteStorageObject(asset.storageKey).catch(() => undefined)),
  );

  return NextResponse.json({
    ok: true,
    asset: {
      id: assetId,
      kind: "thumbnail",
      storageKey: uploaded.key,
      publicUrl: getStoragePublicUrl(uploaded.key),
      metadata: {
        mimeType: validatedUpload.contentType,
        bytes: validatedUpload.bytes,
        originalFilename: validatedUpload.filename,
      },
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;
  const project = await getOwnedProject(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const existingThumbnails = await db.query.projectAssets.findMany({
    where: and(
      eq(projectAssets.projectId, projectId),
      eq(projectAssets.ownerId, userId),
      eq(projectAssets.kind, "thumbnail"),
    ),
  });

  if (existingThumbnails.length > 0) {
    await db
      .delete(projectAssets)
      .where(
        and(
          eq(projectAssets.projectId, projectId),
          eq(projectAssets.ownerId, userId),
          eq(projectAssets.kind, "thumbnail"),
        ),
      );
    await Promise.all(
      existingThumbnails.map((asset) => deleteStorageObject(asset.storageKey).catch(() => undefined)),
    );
  }

  return NextResponse.json({ ok: true });
}
