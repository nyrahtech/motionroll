"use client";

import {
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
} from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import type { ProjectDraftDocument } from "@motionroll/shared";

export type LocalProjectDraftRecord = {
  projectId: string;
  draft: ProjectDraftDocument;
  remoteRevision: number;
  lastSyncedRevision: number;
  dirty: boolean;
  lastLocalSaveAt: string;
  lastSyncedAt?: string;
  pendingSyncAt?: string;
};

type LocalMetaRecord = {
  key: string;
  value: string;
  updatedAt: string;
};

type LocalProjectCollections = {
  projectDrafts: RxCollection<LocalProjectDraftRecord>;
  meta: RxCollection<LocalMetaRecord>;
};

const DATABASE_NAME = "motionroll-local-projects-rxdb-v1";

const localProjectDraftSchema = {
  title: "motionroll local project draft",
  version: 0,
  primaryKey: "projectId",
  type: "object",
  properties: {
    projectId: {
      type: "string",
      maxLength: 128,
    },
    draft: {
      type: "object",
      additionalProperties: true,
    },
    remoteRevision: {
      type: "number",
      minimum: 0,
      multipleOf: 1,
    },
    lastSyncedRevision: {
      type: "number",
      minimum: 0,
      multipleOf: 1,
    },
    dirty: {
      type: "boolean",
    },
    lastLocalSaveAt: {
      type: "string",
    },
    lastSyncedAt: {
      type: "string",
    },
    pendingSyncAt: {
      type: "string",
    },
  },
  required: [
    "projectId",
    "draft",
    "remoteRevision",
    "lastSyncedRevision",
    "dirty",
    "lastLocalSaveAt",
  ],
  indexes: ["dirty", "remoteRevision", "lastSyncedRevision", "lastLocalSaveAt"],
  additionalProperties: false,
} as const;

const localMetaSchema = {
  title: "motionroll local project meta",
  version: 0,
  primaryKey: "key",
  type: "object",
  properties: {
    key: {
      type: "string",
      maxLength: 128,
    },
    value: {
      type: "string",
    },
    updatedAt: {
      type: "string",
    },
  },
  required: ["key", "value", "updatedAt"],
  additionalProperties: false,
} as const;

let databasePromise: Promise<RxDatabase<LocalProjectCollections>> | null = null;

async function getLocalProjectDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await createRxDatabase<LocalProjectCollections>({
        name: DATABASE_NAME,
        storage: getRxStorageDexie(),
        multiInstance: false,
        eventReduce: true,
      });

      await db.addCollections({
        projectDrafts: { schema: localProjectDraftSchema },
        meta: { schema: localMetaSchema },
      });

      return db;
    })();
  }

  return databasePromise;
}

function toLocalProjectDraftRecord(doc: unknown) {
  if (!doc) return undefined;
  const record = doc as LocalProjectDraftRecord;
  return {
    projectId: record.projectId,
    draft: structuredClone(record.draft),
    remoteRevision: record.remoteRevision,
    lastSyncedRevision: record.lastSyncedRevision,
    dirty: record.dirty,
    lastLocalSaveAt: record.lastLocalSaveAt,
    lastSyncedAt: record.lastSyncedAt,
    pendingSyncAt: record.pendingSyncAt,
  } satisfies LocalProjectDraftRecord;
}

async function clearCollection<T extends { [key: string]: unknown }>(
  collection: RxCollection<T>,
) {
  const docs = await collection.find().exec();
  if (docs.length === 0) return;
  await collection.bulkRemove(docs.map((doc) => doc.primary));
}

export const localProjectDb = {
  projectDrafts: {
    async clear() {
      const db = await getLocalProjectDatabase();
      await clearCollection(db.projectDrafts);
    },
    async put(record: LocalProjectDraftRecord) {
      const db = await getLocalProjectDatabase();
      await db.projectDrafts.incrementalUpsert(record);
    },
    async get(projectId: string) {
      const db = await getLocalProjectDatabase();
      const doc = await db.projectDrafts.findOne(projectId).exec();
      return toLocalProjectDraftRecord(doc?.toJSON());
    },
  },
  meta: {
    async clear() {
      const db = await getLocalProjectDatabase();
      await clearCollection(db.meta);
    },
  },
} as const;

export async function getLocalProjectDraft(projectId: string) {
  return localProjectDb.projectDrafts.get(projectId);
}

export async function saveLocalProjectDraft(record: LocalProjectDraftRecord) {
  const db = await getLocalProjectDatabase();
  await db.projectDrafts.incrementalUpsert(record);
  await db.meta.incrementalUpsert({
    key: "last-opened-project-id",
    value: record.projectId,
    updatedAt: new Date().toISOString(),
  });
}

export async function setLastOpenedProjectId(projectId: string) {
  const db = await getLocalProjectDatabase();
  await db.meta.incrementalUpsert({
    key: "last-opened-project-id",
    value: projectId,
    updatedAt: new Date().toISOString(),
  });
}
