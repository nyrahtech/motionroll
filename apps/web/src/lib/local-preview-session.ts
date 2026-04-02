"use client";

import type { ProjectManifest } from "@motionroll/shared";

const LOCAL_PREVIEW_PREFIX = "motionroll-local-preview:";
const LOCAL_PREVIEW_MAX_AGE_MS = 30 * 60 * 1000;

type LocalPreviewSessionRecord = {
  projectId: string;
  manifest: ProjectManifest;
  createdAt: string;
};

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function buildStorageKey(sessionId: string) {
  return `${LOCAL_PREVIEW_PREFIX}${sessionId}`;
}

function isExpired(createdAt: string, now = Date.now()) {
  return now - new Date(createdAt).getTime() > LOCAL_PREVIEW_MAX_AGE_MS;
}

export function purgeExpiredLocalPreviewSessions() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const now = Date.now();
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(LOCAL_PREVIEW_PREFIX)) {
      continue;
    }
    const raw = storage.getItem(key);
    if (!raw) {
      storage.removeItem(key);
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as LocalPreviewSessionRecord;
      if (isExpired(parsed.createdAt, now)) {
        storage.removeItem(key);
      }
    } catch {
      storage.removeItem(key);
    }
  }
}

export function createLocalPreviewSession(projectId: string, manifest: ProjectManifest) {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  purgeExpiredLocalPreviewSessions();
  const sessionId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

  const record: LocalPreviewSessionRecord = {
    projectId,
    manifest,
    createdAt: new Date().toISOString(),
  };

  try {
    storage.setItem(buildStorageKey(sessionId), JSON.stringify(record));
    return sessionId;
  } catch {
    return null;
  }
}

export function readLocalPreviewSession(projectId: string, sessionId?: string | null) {
  if (!sessionId) {
    return null;
  }

  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(buildStorageKey(sessionId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LocalPreviewSessionRecord;
    if (parsed.projectId !== projectId || isExpired(parsed.createdAt)) {
      storage.removeItem(buildStorageKey(sessionId));
      return null;
    }
    return parsed.manifest;
  } catch {
    storage.removeItem(buildStorageKey(sessionId));
    return null;
  }
}
