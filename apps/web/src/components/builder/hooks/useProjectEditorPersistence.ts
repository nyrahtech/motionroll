"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectDraftDocument, ProjectManifest } from "@motionroll/shared";
import { toast } from "sonner";
import type { EditorContainerProps } from "../editor-types";
import {
  SAVE_DEBOUNCE_MS,
  type SaveState,
} from "../project-builder-restored.helpers";
import { serializeProjectDraftDocument } from "@/lib/project-draft";

type UseProjectEditorPersistenceArgs = {
  project: EditorContainerProps["project"];
  manifest: ProjectManifest;
  initialDraft: ProjectDraftDocument;
  draft: ProjectDraftDocument;
};

export function useProjectEditorPersistence({
  project,
  manifest,
  initialDraft,
  draft,
}: UseProjectEditorPersistenceArgs) {
  const [projectState, setProjectState] = useState(project);
  const [manifestState, setManifestState] = useState(manifest);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const draftRef = useRef(draft);
  const revisionRef = useRef(project.draftRevision ?? 0);
  const lastSavedSignatureRef = useRef(JSON.stringify(serializeProjectDraftDocument(initialDraft)));
  const renameTitleRef = useRef(project.title);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const persistProjectTitle = useCallback(async (title: string) => {
    if (renameTitleRef.current === title.trim()) {
      return;
    }

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });

    if (!response.ok) {
      return;
    }

    renameTitleRef.current = title.trim();
    setProjectState((current) => ({ ...current, title: title.trim() }));
  }, [project.id]);

  const saveDraftNow = useCallback(async () => {
    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }

    const payload = serializeProjectDraftDocument(draftRef.current);
    const signature = JSON.stringify(payload);

    if (signature === lastSavedSignatureRef.current) {
      setSaveState("saved");
      return true;
    }

    const savePromise = (async () => {
      setSaveState("saving");
      const response = await fetch(`/api/projects/${project.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: payload,
          baseRevision: revisionRef.current,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({ error: "Draft save failed." }))) as {
          error?: string;
          revision?: number;
        };
        if (typeof data.revision === "number") {
          revisionRef.current = data.revision;
        }
        setSaveState("error");
        toast.error(data.error ?? "Draft save failed.");
        return false;
      }

      const data = (await response.json()) as { revision: number };
      revisionRef.current = data.revision;
      lastSavedSignatureRef.current = signature;
      setSaveState("saved");
      await persistProjectTitle(draftRef.current.title);
      return true;
    })().finally(() => {
      savePromiseRef.current = null;
    });

    savePromiseRef.current = savePromise;
    return savePromise;
  }, [persistProjectTitle, project.id]);

  useEffect(() => {
    const signature = JSON.stringify(serializeProjectDraftDocument(draft));
    if (signature === lastSavedSignatureRef.current) {
      return;
    }

    setSaveState((current) => (current === "saving" ? current : "dirty"));
    const timeout = window.setTimeout(() => {
      void saveDraftNow();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [draft, saveDraftNow]);

  const queueKeepaliveCheckpoint = useCallback(() => {
    const payload = serializeProjectDraftDocument(draftRef.current);
    const signature = JSON.stringify(payload);
    if (signature === lastSavedSignatureRef.current) {
      return false;
    }

    const endpoint = `/api/projects/${project.id}/draft`;
    const body = JSON.stringify({
      draft: payload,
      baseRevision: revisionRef.current,
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        if (navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }))) {
          return true;
        }
      } catch {
        // Fall through to fetch keepalive.
      }
    }

    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);

    return true;
  }, [project.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        queueKeepaliveCheckpoint();
      }
    };

    window.addEventListener("pagehide", queueKeepaliveCheckpoint);
    window.addEventListener("beforeunload", queueKeepaliveCheckpoint);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      queueKeepaliveCheckpoint();
      window.removeEventListener("pagehide", queueKeepaliveCheckpoint);
      window.removeEventListener("beforeunload", queueKeepaliveCheckpoint);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queueKeepaliveCheckpoint]);

  const refreshProjectRuntimeState = useCallback(async () => {
    const [projectResponse, manifestResponse] = await Promise.all([
      fetch(`/api/projects/${project.id}`, { cache: "no-store" }),
      fetch(`/api/projects/${project.id}/manifest`, { cache: "no-store" }),
    ]);

    if (projectResponse.ok) {
      setProjectState((await projectResponse.json()) as EditorContainerProps["project"]);
    }

    if (manifestResponse.ok) {
      setManifestState((await manifestResponse.json()) as ProjectManifest);
    }
  }, [project.id]);

  const hasActiveProcessingJob = useMemo(
    () => projectState.jobs.some((job) => job.status === "queued" || job.status === "running"),
    [projectState.jobs],
  );

  useEffect(() => {
    if (!hasActiveProcessingJob) {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      return;
    }

    refreshTimeoutRef.current = setTimeout(() => {
      void refreshProjectRuntimeState();
    }, 1600);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [hasActiveProcessingJob, refreshProjectRuntimeState]);

  const topBarSaveStatus = useMemo<{
    local: "saving" | "saved" | "error";
    remote: "idle" | "syncing" | "synced" | "error";
    hasUnsyncedChanges: boolean;
    hasUnpublishedChanges: boolean;
  }>(
    () => ({
      local: saveState === "saving" ? "saving" : saveState === "error" ? "error" : "saved",
      remote: saveState === "error" ? "error" : "synced",
      hasUnsyncedChanges: saveState === "dirty" || saveState === "error",
      hasUnpublishedChanges: saveState === "dirty",
    }),
    [saveState],
  );

  return {
    draftRef,
    manifestState,
    projectState,
    refreshProjectRuntimeState,
    saveDraftNow,
    saveState,
    topBarSaveStatus,
  };
}
