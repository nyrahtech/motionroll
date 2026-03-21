import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { OverlayContentSchema } from "@motionroll/shared";
import { z } from "zod";
import { db } from "@/db/client";
import {
  processingJobs,
  projectAssets,
  projectOverlays,
  projectSections,
  projects,
} from "@/db/schema";
import { buildProjectManifest } from "@/lib/manifest";
import { LOCAL_OWNER } from "@/lib/data/local-owner";
import { getProjectById, switchProjectPreset } from "@/lib/data/projects";
import { env } from "@/lib/env";
import { getSourceAssetValidationError } from "@/lib/project-assets";
import { dispatchProcessingJob } from "@/lib/processing-dispatch";

export const dynamic = "force-dynamic";

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  sectionTitle: z.string().min(1).optional(),
  presetId: z
    .enum([
      "scroll-sequence",
      "product-reveal",
      "feature-walkthrough",
      "before-after",
      "device-spin",
      "chaptered-scroll-story",
    ])
    .optional(),
  sectionHeightVh: z.number().min(100).max(600).optional(),
  scrubStrength: z.number().min(0.05).max(4).optional(),
  frameRangeStart: z.number().int().nonnegative().optional(),
  frameRangeEnd: z.number().int().positive().optional(),
  frameRange: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().positive(),
    })
    .optional(),
  selectedOverlayId: z.string().min(1).optional(),
  overlayStart: z.number().min(0).max(1).optional(),
  overlayEnd: z.number().min(0).max(1).optional(),
  overlayTimings: z
    .array(
      z.object({
        overlayId: z.string().min(1),
        start: z.number().min(0).max(1),
        end: z.number().min(0).max(1),
      }),
    )
    .optional(),
  overlays: z
    .array(
      z.object({
        id: z.string().min(1),
        timing: z.object({
          start: z.number().min(0).max(1),
          end: z.number().min(0).max(1),
        }),
        content: OverlayContentSchema,
      }),
    )
    .optional(),
  text: z.string().min(1).optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
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
  const { projectId } = await params;
  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = updateProjectSchema.parse(await request.json());
  if (body.presetId) {
    await switchProjectPreset(projectId, body.presetId);
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, LOCAL_OWNER.id)),
    with: {
      sections: {
        with: {
          overlays: true,
        },
      },
      assets: true,
      publishTargets: true,
    },
  });

  if (!project || project.sections.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const section = project.sections[0];
  if (!section) {
    return NextResponse.json({ error: "Project section not found" }, { status: 404 });
  }

  const nextStatus = project.publishTargets.some((target) => target.publishedAt)
    ? "ready"
    : project.assets.some((asset) => asset.kind === "frame_sequence" || asset.kind === "frame")
      ? "ready"
      : "draft";
  const primaryOverlay = body.overlays?.[0];
  const primaryCtaOverlay = body.overlays?.find((overlay) => overlay.content.cta);

  await db
    .update(projects)
    .set({
      title: body.title ?? project.title,
      selectedPreset: body.presetId ?? project.selectedPreset,
      status: nextStatus,
      failureReason: null,
      lastSavedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  await db
    .update(projectSections)
    .set({
      title: body.sectionTitle ?? section.title,
      commonConfig: {
        ...section.commonConfig,
        sectionHeightVh: body.sectionHeightVh ?? section.commonConfig.sectionHeightVh,
        scrubStrength: body.scrubStrength ?? section.commonConfig.scrubStrength,
        frameRange: {
          start:
            body.frameRange?.start ??
            body.frameRangeStart ??
            section.commonConfig.frameRange.start,
          end:
            body.frameRange?.end ??
            body.frameRangeEnd ??
            section.commonConfig.frameRange.end,
        },
        text: {
          ...section.commonConfig.text,
          content:
            primaryOverlay?.content.text ??
            body.text ??
            section.commonConfig.text.content,
        },
        cta: {
          label:
            primaryCtaOverlay?.content.cta?.label ??
            body.ctaLabel ??
            section.commonConfig.cta.label,
          href:
            primaryCtaOverlay?.content.cta?.href ??
            body.ctaHref ??
            section.commonConfig.cta.href,
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(projectSections.id, section.id));

  if (
    body.selectedOverlayId &&
    typeof body.overlayStart === "number" &&
    typeof body.overlayEnd === "number"
  ) {
    await db
      .update(projectOverlays)
      .set({
        timing: {
          start: body.overlayStart,
          end: body.overlayEnd,
        },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectOverlays.projectSectionId, section.id),
          eq(projectOverlays.overlayKey, body.selectedOverlayId),
        ),
      );
  }

  if (body.overlayTimings?.length) {
    for (const overlayTiming of body.overlayTimings) {
      await db
        .update(projectOverlays)
        .set({
          timing: {
            start: overlayTiming.start,
            end: overlayTiming.end,
          },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projectOverlays.projectSectionId, section.id),
            eq(projectOverlays.overlayKey, overlayTiming.overlayId),
          ),
        );
    }
  }

  if (body.overlays) {
    const incomingOverlayIds = new Set(body.overlays.map((overlay) => overlay.id));

    for (const [sortOrder, overlay] of body.overlays.entries()) {
      const existing = section.overlays.find((item) => item.overlayKey === overlay.id);
      if (existing) {
        await db
          .update(projectOverlays)
          .set({
            sortOrder,
            timing: overlay.timing,
            content: overlay.content,
            updatedAt: new Date(),
          })
          .where(eq(projectOverlays.id, existing.id));
        continue;
      }

      await db.insert(projectOverlays).values({
        projectSectionId: section.id,
        overlayKey: overlay.id,
        sortOrder,
        timing: overlay.timing,
        content: overlay.content,
      });
    }

    for (const overlay of section.overlays) {
      if (!incomingOverlayIds.has(overlay.overlayKey)) {
        await db.delete(projectOverlays).where(eq(projectOverlays.id, overlay.id));
      }
    }
  }

  const manifest = await buildProjectManifest(project.id);
  const updatedProject = await getProjectById(project.id);
  return NextResponse.json({ ok: true, manifest, project: updatedProject });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = enqueueSchema.parse(await request.json());
  const asset = await db.query.projectAssets.findFirst({
    where: and(
      eq(projectAssets.id, body.assetId),
      eq(projectAssets.projectId, projectId),
      eq(projectAssets.ownerId, LOCAL_OWNER.id),
    ),
  });

  const assetError = getSourceAssetValidationError({
    asset,
    projectId,
    sourceType: body.sourceType,
    sourceOrigin: body.sourceOrigin,
    maxBytes: env.UPLOAD_MAX_VIDEO_BYTES,
  });

  if (assetError) {
    return NextResponse.json(
      { error: assetError },
      { status: assetError === "Asset not found for project." ? 404 : 400 },
    );
  }

  const [job] = await db
    .insert(processingJobs)
    .values({
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
    })
    .returning();
  if (!job) {
    return NextResponse.json({ error: "Job creation failed" }, { status: 500 });
  }

  const dispatch = await dispatchProcessingJob(job.id, job.payload);

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    assetId: body.assetId,
    processingMode: dispatch.mode,
  });
}
