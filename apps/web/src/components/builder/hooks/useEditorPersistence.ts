/**
 * useEditorPersistence — owns all local IndexedDB + remote sync state.
 * Keeps drafts alive across reloads and coalesces network writes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectDraftDocument } from "@motionroll/shared";
import {
  getLocalProjectDraft,
  saveLocalProjectDraft,
  setLastOpenedProjectId,
  type LocalProjectDraftRecord,
} from "../../../lib/local-project-db";
import type { EditorDraft } from "../editor-draft-types";
import { editorDraftToDocument } from "../editor-draft-utils";

export type LocalSaveState = "saving" | "saved" | "error";
export type RemoteSyncState = "idle" | "syncing" | "synced" | "error";

type DraftSyncResponse = {
  ok?: boolean;
  conflict?: boolean;
  draft?: ProjectDraftDocument;
  manifest?: unknown;
  project?: unknown;
  revision?: number;
  updatedAt?: string;
  error?: string;
  retryable?: boolean;
  code?: string;
};

export type UseEditorPersistenceReturn = {
  localSaveState: LocalSaveState;
  remoteSyncState: RemoteSyncState;
  hasUnsyncedChanges: boolean;
  persistenceReadyRef: React.MutableRefObject<boolean>;
  lastSyncedRevisionRef: React.MutableRefObject<number>;
  setRemoteSyncState: React.Dispatch<React.SetStateAction<RemoteSyncState>>;
  setHasUnsyncedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  scheduleRemoteSync: (delay?: number) => void;
  flushRemoteSync: () => Promise<boolean>;
  writeDraftLocally: (
    draft: EditorDraft,
    options: { dirty: boolean; lastSyncedRevision?: number; lastSyncedAt?: string },
  ) => Promise<void>;
};

export function useEditorPersistence({
  projectId,
  initialDraftRevision,
  initialUpdatedAt,
  draftRef,
  draftVersionRef,
  hasUnsyncedChangesRef,
  replaceDraftStateFromDocument,
  setProjectStateFromResponse,
  setManifestStateFromResponse,
}: {
  projectId: string;
  initialDraftRevision: number;
  initialUpdatedAt: string;
  draftRef: React.MutableRefObject<EditorDraft>;
  draftVersionRef: React.MutableRefObject<number>;
  hasUnsyncedChangesRef: React.MutableRefObject<boolean>;
  replaceDraftStateFromDocument: (
    doc: ProjectDraftDocument,
    options?: { clearHistory?: boolean; hasUnsyncedChanges?: boolean },
  ) => void;
  setProjectStateFromResponse: (project: unknown) => void;
  setManifestStateFromResponse: (manifest: unknown) => void;
}): UseEditorPersistenceReturn {
  const [localSaveState, setLocalSaveState] = useState<LocalSaveState>("saved");
  const [remoteSyncState, setRemoteSyncState] = useState<RemoteSyncState>("synced");
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);

  const persistenceReadyRef = useRef(false);
  const syncTimeoutRef = useRef<number | null>(null);
  const syncPromiseRef = useRef<Promise<boolean> | null>(null);
  const pendingSyncAfterCurrentRef = useRef(false);
  const lastSyncedRevisionRef = useRef(initialDraftRevision);
  const latestLocalSaveAtRef = useRef(initialUpdatedAt);
  const localSaveIndicatorTimeoutRef = useRef<number | null>(null);
  // Stable ref to scheduleRemoteSync so flushRemoteSync can call it without
  // being listed as a dependency (breaks the circular dep).
  const scheduleRemoteSyncRef = useRef<(delay?: number) => void>(() => {});

  const readSyncResponse = useCallback(async (response: Response): Promise<DraftSyncResponse> => {
    try {
      return (await response.json()) as DraftSyncResponse;
    } catch {
      return {};
    }
  }, []);

  const clearScheduledSync = useCallback(() => {
    if (syncTimeoutRef.current != null) {
      window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  const writeDraftLocally = useCallback(
    async (
      draft: EditorDraft,
      options: { dirty: boolean; lastSyncedRevision?: number; lastSyncedAt?: string },
    ) => {
      const now = new Date().toISOString();
      latestLocalSaveAtRef.current = now;

      if (localSaveIndicatorTimeoutRef.current != null) {
        window.clearTimeout(localSaveIndicatorTimeoutRef.current);
      }
      localSaveIndicatorTimeoutRef.current = window.setTimeout(() => {
        setLocalSaveState("saving");
      }, 120);

      const record: LocalProjectDraftRecord = {
        projectId,
        draft: editorDraftToDocument(draft),
        remoteRevision: options.lastSyncedRevision ?? lastSyncedRevisionRef.current,
        lastSyncedRevision: options.lastSyncedRevision ?? lastSyncedRevisionRef.current,
        dirty: options.dirty,
        lastLocalSaveAt: now,
        lastSyncedAt: options.lastSyncedAt,
        pendingSyncAt: options.dirty ? now : undefined,
      };

      try {
        await saveLocalProjectDraft(record);
        if (localSaveIndicatorTimeoutRef.current != null) {
          window.clearTimeout(localSaveIndicatorTimeoutRef.current);
          localSaveIndicatorTimeoutRef.current = null;
        }
        setLocalSaveState("saved");
      } catch {
        if (localSaveIndicatorTimeoutRef.current != null) {
          window.clearTimeout(localSaveIndicatorTimeoutRef.current);
          localSaveIndicatorTimeoutRef.current = null;
        }
        setLocalSaveState("error");
      }
    },
    [projectId],
  );

  const flushRemoteSync = useCallback(async (): Promise<boolean> => {
    if (!persistenceReadyRef.current || !hasUnsyncedChangesRef.current) return true;
    clearScheduledSync();

    if (syncPromiseRef.current) {
      pendingSyncAfterCurrentRef.current = true;
      return syncPromiseRef.current;
    }

    const payload = editorDraftToDocument(draftRef.current);
    const syncedDraftVersion = draftVersionRef.current;
    const baseRevision = lastSyncedRevisionRef.current;
    setRemoteSyncState("syncing");

    const syncPromise = fetch(`/api/projects/${projectId}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft: payload, baseRevision }),
    })
      .then(async (response) => {
        const data = await readSyncResponse(response);

        if (
          response.status === 409 &&
          data.conflict &&
          data.draft &&
          typeof data.revision === "number" &&
          typeof data.updatedAt === "string"
        ) {
          const localIsNewer =
            latestLocalSaveAtRef.current >= data.updatedAt || hasUnsyncedChangesRef.current;
          console.warn(
            `[MotionRoll] Draft revision mismatch for ${projectId}. ` +
              `localRevision=${baseRevision} remoteRevision=${data.revision}`,
          );
          lastSyncedRevisionRef.current = data.revision;
          if (localIsNewer) {
            setRemoteSyncState("idle");
            scheduleRemoteSyncRef.current(150);
            return false;
          }
          replaceDraftStateFromDocument(data.draft, {
            clearHistory: false,
            hasUnsyncedChanges: false,
          });
          setRemoteSyncState("synced");
          if (data.project) setProjectStateFromResponse(data.project);
          if (data.manifest) setManifestStateFromResponse(data.manifest);
          await writeDraftLocally(
            // We need to reconstruct EditorDraft from document here - pass doc to write
            draftRef.current,
            { dirty: false, lastSyncedRevision: data.revision, lastSyncedAt: data.updatedAt },
          );
          return false;
        }

        if (!response.ok) {
          if (data.retryable) {
            setRemoteSyncState("idle");
            scheduleRemoteSyncRef.current(1800);
            return false;
          }
          setRemoteSyncState("error");
          return false;
        }

        if (typeof data.revision !== "number" || typeof data.updatedAt !== "string") {
          setRemoteSyncState("error");
          return false;
        }

        lastSyncedRevisionRef.current = data.revision;
        if (data.project) setProjectStateFromResponse(data.project);
        if (data.manifest) setManifestStateFromResponse(data.manifest);
        const stillMatchesSyncedPayload = draftVersionRef.current === syncedDraftVersion;
        setHasUnsyncedChanges(!stillMatchesSyncedPayload);
        setRemoteSyncState(stillMatchesSyncedPayload ? "synced" : "idle");
        await writeDraftLocally(draftRef.current, {
          dirty: !stillMatchesSyncedPayload,
          lastSyncedRevision: data.revision,
          lastSyncedAt: data.updatedAt,
        });
        if (!stillMatchesSyncedPayload) scheduleRemoteSyncRef.current(250);
        return true;
      })
      .catch(() => {
        setRemoteSyncState("idle");
        scheduleRemoteSyncRef.current(1800);
        return false;
      })
      .finally(() => {
        syncPromiseRef.current = null;
        if (pendingSyncAfterCurrentRef.current) {
          pendingSyncAfterCurrentRef.current = false;
          scheduleRemoteSyncRef.current(200);
        }
      });

    syncPromiseRef.current = syncPromise;
    return syncPromise;
  }, [
    projectId,
    clearScheduledSync,
    draftVersionRef,
    readSyncResponse,
    writeDraftLocally,
    replaceDraftStateFromDocument,
    setProjectStateFromResponse,
    setManifestStateFromResponse,
  ]);

  const scheduleRemoteSync = useCallback((delay = 900) => {
    if (!persistenceReadyRef.current || !hasUnsyncedChangesRef.current) return;
    clearScheduledSync();
    syncTimeoutRef.current = window.setTimeout(() => {
      void flushRemoteSync();
    }, delay);
  }, [clearScheduledSync, flushRemoteSync]);

  // Keep the ref in sync so flushRemoteSync can call schedule without a dep cycle
  scheduleRemoteSyncRef.current = scheduleRemoteSync;

  // Hydrate on project load
  useEffect(() => {
    let cancelled = false;

    async function hydrateProjectState() {
      await setLastOpenedProjectId(projectId);
      const remoteUpdatedAt = initialUpdatedAt;
      const localRecord = await getLocalProjectDraft(projectId);
      if (cancelled) return;

      if (
        localRecord &&
        (localRecord.dirty ||
          localRecord.lastSyncedRevision > lastSyncedRevisionRef.current ||
          localRecord.lastLocalSaveAt >= remoteUpdatedAt)
      ) {
        replaceDraftStateFromDocument(localRecord.draft, {
          clearHistory: true,
          hasUnsyncedChanges: localRecord.dirty,
        });
        if (localRecord.dirty) {
          setRemoteSyncState("idle");
        } else {
          setRemoteSyncState("synced");
        }
        lastSyncedRevisionRef.current = localRecord.lastSyncedRevision;
        latestLocalSaveAtRef.current = localRecord.lastLocalSaveAt;
      } else {
        await writeDraftLocally(draftRef.current, {
          dirty: false,
          lastSyncedRevision: lastSyncedRevisionRef.current,
          lastSyncedAt: remoteUpdatedAt,
        });
      }

      persistenceReadyRef.current = true;
      if (localRecord?.dirty) {
        scheduleRemoteSyncRef.current(1800);
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/draft`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const errorData = await readSyncResponse(response);
          if (errorData.retryable) {
            setRemoteSyncState("idle");
            if (hasUnsyncedChangesRef.current) {
              scheduleRemoteSyncRef.current(1800);
            }
            return;
          }
          setRemoteSyncState("error");
          return;
        }

        const data = await readSyncResponse(response);
        if (!data.draft || typeof data.revision !== "number" || typeof data.updatedAt !== "string") {
          setRemoteSyncState("error");
          return;
        }

        if (cancelled) return;

        const localAfterFetch = await getLocalProjectDraft(projectId);
        if (cancelled) return;

        lastSyncedRevisionRef.current = data.revision;
        if (
          localAfterFetch &&
          (localAfterFetch.dirty || localAfterFetch.lastLocalSaveAt > data.updatedAt)
        ) {
          console.warn(
            `[MotionRoll] Keeping newer local draft for ${projectId} while remote cache refresh completed.`,
          );
          if (localAfterFetch.dirty) {
            setRemoteSyncState("idle");
            scheduleRemoteSyncRef.current(1800);
          }
          return;
        }

        if (data.project) setProjectStateFromResponse(data.project);
        setManifestStateFromResponse(data.manifest);
        replaceDraftStateFromDocument(data.draft, {
          clearHistory: true,
          hasUnsyncedChanges: false,
        });
        setRemoteSyncState("synced");
        setHasUnsyncedChanges(false);
        await writeDraftLocally(draftRef.current, {
          dirty: false,
          lastSyncedRevision: data.revision,
          lastSyncedAt: data.updatedAt,
        });
      } catch {
        setRemoteSyncState("idle");
        if (hasUnsyncedChangesRef.current) {
          scheduleRemoteSyncRef.current(1800);
        }
      }
    }

    void hydrateProjectState();

    return () => {
      cancelled = true;
      persistenceReadyRef.current = false;
      clearScheduledSync();
      if (localSaveIndicatorTimeoutRef.current != null) {
        window.clearTimeout(localSaveIndicatorTimeoutRef.current);
        localSaveIndicatorTimeoutRef.current = null;
      }
    };
  // Hydration runs once per project. All called functions (writeDraftLocally,
  // replaceDraftStateFromDocument, etc.) are stable useCallback refs — adding them
  // to deps would not change behavior but would trigger the linter to mark them as
  // missing if the parent ever passes inline functions. Kept minimal intentionally.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Page-visibility / unload flush
  useEffect(() => {
    if (!persistenceReadyRef.current) return;

    const flush = () => {
      if (hasUnsyncedChanges) void flushRemoteSync();
    };
    const queueBackgroundSync = () => {
      if (!hasUnsyncedChangesRef.current || !persistenceReadyRef.current) return false;
      const payload = editorDraftToDocument(draftRef.current);
      const body = JSON.stringify({ draft: payload, baseRevision: lastSyncedRevisionRef.current });
      const endpoint = `/api/projects/${projectId}/draft`;
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          if (navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }))) {
            return true;
          }
        } catch {
          // fall through to fetch
        }
      }
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
      return true;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("blur", flush);
    window.addEventListener("pagehide", queueBackgroundSync);
    window.addEventListener("beforeunload", queueBackgroundSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", flush);
      window.removeEventListener("pagehide", queueBackgroundSync);
      window.removeEventListener("beforeunload", queueBackgroundSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasUnsyncedChanges, flushRemoteSync, projectId]);

  return {
    localSaveState,
    remoteSyncState,
    hasUnsyncedChanges,
    persistenceReadyRef,
    lastSyncedRevisionRef,
    setRemoteSyncState,
    setHasUnsyncedChanges,
    scheduleRemoteSync,
    flushRemoteSync,
    writeDraftLocally,
  };
}
