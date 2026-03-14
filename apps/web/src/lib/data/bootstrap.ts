import { presetDefinitions } from "@motionroll/shared";
import { db } from "@/db/client";
import { templates, users } from "@/db/schema";
import { LOCAL_OWNER } from "./local-owner";

let bootstrapPromise: Promise<void> | undefined;

async function bootstrapLocalOwnerAndTemplates() {
  await db
    .insert(users)
    .values({
      id: LOCAL_OWNER.id,
      email: LOCAL_OWNER.email,
      name: LOCAL_OWNER.name,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: LOCAL_OWNER.email,
        name: LOCAL_OWNER.name,
      },
    });

  for (const preset of presetDefinitions) {
    await db
      .insert(templates)
      .values({
        id: preset.id,
        presetId: preset.id,
        label: preset.label,
        description: preset.description,
        thumbnailUrl: preset.previewThumbnail,
        defaults: preset.defaults,
        exposedControls: preset.exposedControls,
        advancedControls: preset.advancedControls,
        seededOverlays: preset.seededOverlays,
      })
      .onConflictDoUpdate({
        target: templates.id,
        set: {
          presetId: preset.id,
          label: preset.label,
          description: preset.description,
          thumbnailUrl: preset.previewThumbnail,
          defaults: preset.defaults,
          exposedControls: preset.exposedControls,
          advancedControls: preset.advancedControls,
          seededOverlays: preset.seededOverlays,
        },
      });
  }
}

export async function ensureLocalOwnerAndTemplates() {
  bootstrapPromise ??= bootstrapLocalOwnerAndTemplates().catch((error) => {
    bootstrapPromise = undefined;
    throw error;
  });

  await bootstrapPromise;
}
