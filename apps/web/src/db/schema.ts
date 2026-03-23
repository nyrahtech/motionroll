import {
  type GeneratedAsset,
  type OverlayContent,
  type OverlayTiming,
  type PresetControl,
  type PresetDefaults,
  type PresetId,
  type ProjectDraftDocument,
  type PresetSpecificConfig,
  type ProcessingJobPayload,
  type ProcessingOutputs,
  type ProjectManifest,
  type ProviderCredentialMetadata,
} from "@motionroll/shared";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "processing",
  "ready",
  "published",
  "failed",
]);
export const sourceTypeEnum = pgEnum("source_type", ["video", "ai_clip"]);
export const sourceOriginEnum = pgEnum("source_origin", ["upload", "ai_import"]);
export const assetKindEnum = pgEnum("asset_kind", [
  "source_video",
  "frame_sequence",
  "frame",
  "poster",
  "fallback_video",
  "thumbnail",
]);
export const assetVariantKindEnum = pgEnum("asset_variant_kind", [
  "original",
  "desktop",
  "tablet",
  "mobile",
  "poster",
  "fallback_video",
]);
export const processingJobStatusEnum = pgEnum("processing_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);
export const publishTargetTypeEnum = pgEnum("publish_target_type", [
  "hosted_embed",
  "script_embed",
]);
export const providerEnum = pgEnum("provider", ["runway", "luma", "sora", "other"]);
export const providerConnectionStatusEnum = pgEnum("provider_connection_status", [
  "disconnected",
  "pending_validation",
  "connected",
  "error",
]);
export const generationStatusEnum = pgEnum("generation_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "unsupported",
]);
export const transitionScopeEnum = pgEnum("transition_scope", ["sequence", "moment"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const templates = pgTable(
  "templates",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    presetId: varchar("preset_id", { length: 64 }).$type<PresetId>().notNull(),
    label: varchar("label", { length: 256 }).notNull(),
    description: text("description").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    defaults: jsonb("defaults").$type<PresetDefaults>().notNull(),
    exposedControls: jsonb("exposed_controls").$type<PresetControl[]>().notNull(),
    advancedControls: jsonb("advanced_controls").$type<PresetControl[]>().notNull(),
    seededOverlays: jsonb("seeded_overlays").$type<
      Array<{ id: string; timing: OverlayTiming; content: OverlayContent }>
    >().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    presetIdx: uniqueIndex("templates_preset_idx").on(table.presetId),
  }),
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: varchar("owner_id", { length: 64 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    templateId: varchar("template_id", { length: 64 }).references(() => templates.id),
    title: varchar("title", { length: 256 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    selectedPreset: varchar("selected_preset", { length: 64 })
      .$type<PresetId>()
      .notNull(),
    status: projectStatusEnum("status").default("draft").notNull(),
    publishVersion: integer("publish_version").default(1).notNull(),
    latestPublishVersion: integer("latest_publish_version").default(1).notNull(),
    latestPublishId: uuid("latest_publish_id"),
    draftRevision: integer("draft_revision").default(0).notNull(),
    draftJson: jsonb("draft_json").$type<ProjectDraftDocument | null>().default(null),
    lastManifest: jsonb("last_manifest").$type<ProjectManifest | null>().default(null),
    failureReason: text("failure_reason"),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    lastSavedAt: timestamp("last_saved_at", { withTimezone: true }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("projects_slug_idx").on(table.slug),
    ownerIdx: index("projects_owner_idx").on(table.ownerId),
  }),
);

export const projectSections = pgTable(
  "project_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    presetId: varchar("preset_id", { length: 64 }).$type<PresetId>().notNull(),
    commonConfig: jsonb("common_config").$type<PresetDefaults["common"]>().notNull(),
    presetConfig: jsonb("preset_config").$type<PresetSpecificConfig>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("project_sections_project_idx").on(table.projectId),
  }),
);

export const projectOverlays = pgTable(
  "project_overlays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectSectionId: uuid("project_section_id")
      .references(() => projectSections.id, { onDelete: "cascade" })
      .notNull(),
    overlayKey: varchar("overlay_key", { length: 128 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    timing: jsonb("timing").$type<OverlayTiming>().notNull(),
    content: jsonb("content").$type<OverlayContent>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sectionIdx: index("project_overlays_section_idx").on(table.projectSectionId),
  }),
);

export const projectMoments = pgTable(
  "project_moments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectSectionId: uuid("project_section_id")
      .references(() => projectSections.id, { onDelete: "cascade" })
      .notNull(),
    momentKey: varchar("moment_key", { length: 128 }).notNull(),
    label: varchar("label", { length: 256 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    timing: jsonb("timing").$type<OverlayTiming>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sectionIdx: index("project_moments_section_idx").on(table.projectSectionId),
  }),
);

export const projectTransitions = pgTable(
  "project_transitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectSectionId: uuid("project_section_id")
      .references(() => projectSections.id, { onDelete: "cascade" })
      .notNull(),
    scope: transitionScopeEnum("scope").default("sequence").notNull(),
    fromKey: varchar("from_key", { length: 128 }).notNull(),
    toKey: varchar("to_key", { length: 128 }).notNull(),
    preset: varchar("preset", { length: 64 }).notNull(),
    easing: varchar("easing", { length: 64 }).notNull(),
    durationMs: integer("duration_ms").default(400).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sectionIdx: index("project_transitions_section_idx").on(table.projectSectionId),
  }),
);

export const projectAssets = pgTable(
  "project_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    ownerId: varchar("owner_id", { length: 64 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    kind: assetKindEnum("kind").notNull(),
    sourceType: sourceTypeEnum("source_type"),
    sourceOrigin: sourceOriginEnum("source_origin"),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url").notNull(),
    metadata: jsonb("metadata").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("project_assets_project_idx").on(table.projectId),
    ownerIdx: index("project_assets_owner_idx").on(table.ownerId),
  }),
);

export const assetVariants = pgTable(
  "asset_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .references(() => projectAssets.id, { onDelete: "cascade" })
      .notNull(),
    kind: assetVariantKindEnum("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url").notNull(),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetIdx: index("asset_variants_asset_idx").on(table.assetId),
  }),
);

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    assetId: uuid("asset_id")
      .references(() => projectAssets.id, { onDelete: "cascade" })
      .notNull(),
    status: processingJobStatusEnum("status").default("queued").notNull(),
    payload: jsonb("payload").$type<ProcessingJobPayload>().notNull(),
    outputs: jsonb("outputs").$type<ProcessingOutputs | null>().default(null),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("processing_jobs_project_idx").on(table.projectId),
    assetIdx: index("processing_jobs_asset_idx").on(table.assetId),
  }),
);

export const publishVersions = pgTable(
  "publish_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    assetBasePath: text("asset_base_path").notNull(),
    manifest: jsonb("manifest").$type<ProjectManifest>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index("publish_versions_project_idx").on(table.projectId),
    versionIdx: uniqueIndex("publish_versions_project_version_idx").on(table.projectId, table.version),
  }),
);

export const publishTargets = pgTable(
  "publish_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    targetType: publishTargetTypeEnum("target_type").notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    version: integer("version").default(1).notNull(),
    isReady: boolean("is_ready").default(false).notNull(),
    manifest: jsonb("manifest").$type<ProjectManifest | null>().default(null),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("publish_targets_slug_idx").on(table.slug),
    projectIdx: index("publish_targets_project_idx").on(table.projectId),
  }),
);

export const userProviderConnections = pgTable(
  "user_provider_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 64 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: providerEnum("provider").notNull(),
    status: providerConnectionStatusEnum("status")
      .default("pending_validation")
      .notNull(),
    accountLabel: varchar("account_label", { length: 256 }).notNull(),
    encryptedCredentialPayload: text("encrypted_credential_payload").notNull(),
    credentialMetadata: jsonb("credential_metadata")
      .$type<ProviderCredentialMetadata>()
      .notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("provider_connections_user_idx").on(table.userId),
  }),
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 64 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    providerConnectionId: uuid("provider_connection_id").references(
      () => userProviderConnections.id,
      { onDelete: "set null" },
    ),
    provider: providerEnum("provider").notNull(),
    externalGenerationId: text("external_generation_id"),
    status: generationStatusEnum("status").default("unsupported").notNull(),
    promptText: text("prompt_text"),
    failureReason: text("failure_reason"),
    outputUrl: text("output_url"),
    requestPayload: jsonb("request_payload").notNull(),
    responsePayload: jsonb("response_payload"),
    importedAssetMetadata: jsonb("imported_asset_metadata").$type<GeneratedAsset | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("ai_generations_user_idx").on(table.userId),
    projectIdx: index("ai_generations_project_idx").on(table.projectId),
  }),
);

export const userRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  providerConnections: many(userProviderConnections),
}));

export const templateRelations = relations(templates, ({ many }) => ({
  projects: many(projects),
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [projects.templateId],
    references: [templates.id],
  }),
  sections: many(projectSections),
  assets: many(projectAssets),
  jobs: many(processingJobs),
  publishVersions: many(publishVersions),
  publishTargets: many(publishTargets),
}));

export const sectionRelations = relations(projectSections, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectSections.projectId],
    references: [projects.id],
  }),
  overlays: many(projectOverlays),
  moments: many(projectMoments),
  transitions: many(projectTransitions),
}));

export const projectOverlayRelations = relations(projectOverlays, ({ one }) => ({
  section: one(projectSections, {
    fields: [projectOverlays.projectSectionId],
    references: [projectSections.id],
  }),
}));

export const projectMomentRelations = relations(projectMoments, ({ one }) => ({
  section: one(projectSections, {
    fields: [projectMoments.projectSectionId],
    references: [projectSections.id],
  }),
}));

export const projectTransitionRelations = relations(projectTransitions, ({ one }) => ({
  section: one(projectSections, {
    fields: [projectTransitions.projectSectionId],
    references: [projectSections.id],
  }),
}));

export const assetRelations = relations(projectAssets, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectAssets.projectId],
    references: [projects.id],
  }),
  variants: many(assetVariants),
  jobs: many(processingJobs),
}));

export const assetVariantRelations = relations(assetVariants, ({ one }) => ({
  asset: one(projectAssets, {
    fields: [assetVariants.assetId],
    references: [projectAssets.id],
  }),
}));

export const processingJobRelations = relations(processingJobs, ({ one }) => ({
  project: one(projects, {
    fields: [processingJobs.projectId],
    references: [projects.id],
  }),
  asset: one(projectAssets, {
    fields: [processingJobs.assetId],
    references: [projectAssets.id],
  }),
}));

export const publishTargetRelations = relations(publishTargets, ({ one }) => ({
  project: one(projects, {
    fields: [publishTargets.projectId],
    references: [projects.id],
  }),
}));

export const publishVersionRelations = relations(publishVersions, ({ one }) => ({
  project: one(projects, {
    fields: [publishVersions.projectId],
    references: [projects.id],
  }),
}));
