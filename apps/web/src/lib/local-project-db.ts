"use client";

import Dexie, { type Table } from "dexie";
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
};

class MotionRollLocalProjectDatabase extends Dexie {
  projectDrafts!: Table<LocalProjectDraftRecord, string>;
  meta!: Table<LocalMetaRecord, string>;

  constructor() {
    super("motionroll-local-projects");
    // Local-first cache: one working draft per project plus tiny editor metadata.
    this.version(1).stores({
      projectDrafts: "projectId, dirty, remoteRevision, lastSyncedRevision, lastLocalSaveAt",
      meta: "key",
    });
  }
}

export const localProjectDb = new MotionRollLocalProjectDatabase();

export async function getLocalProjectDraft(projectId: string) {
  return localProjectDb.projectDrafts.get(projectId);
}

export async function saveLocalProjectDraft(record: LocalProjectDraftRecord) {
  await localProjectDb.projectDrafts.put(record);
  await localProjectDb.meta.put({
    key: "last-opened-project-id",
    value: record.projectId,
  });
}

export async function setLastOpenedProjectId(projectId: string) {
  await localProjectDb.meta.put({
    key: "last-opened-project-id",
    value: projectId,
  });
}
