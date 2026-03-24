import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import type { ProjectDraftDocument } from "@motionroll/shared";
import type { EditorDraft } from "../../editor-draft-types";
import { localProjectDb } from "../../../../lib/local-project-db";
import { documentToEditorDraft } from "../../editor-draft-utils";
import { useEditorPersistence } from "../useEditorPersistence";

function makeDraft(title = "Draft Project"): EditorDraft {
  return {
    title,
    presetId: "product-reveal",
    sectionTitle: "Scene 01",
    sceneTransitionPreset: "none",
    sectionHeightVh: 240,
    scrubStrength: 1,
    frameRangeStart: 0,
    frameRangeEnd: 180,
    layerCount: 1,
    overlays: [],
  };
}

function makeDocument(title = "Draft Project"): ProjectDraftDocument {
  return {
    version: 1,
    title,
    presetId: "product-reveal",
    sectionTitle: "Scene 01",
    sceneTransitionPreset: "none",
    sectionHeightVh: 240,
    scrubStrength: 1,
    frameRangeStart: 0,
    frameRangeEnd: 180,
    layerCount: 1,
    overlays: [],
  };
}

function makeJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("useEditorPersistence", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    vi.clearAllMocks();
    await localProjectDb.projectDrafts.clear();
    await localProjectDb.meta.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("hydrates from local draft storage without refetching and replacing editor state", async () => {
    const localDirtyDocument = makeDocument("Local Draft");
    await localProjectDb.projectDrafts.put({
      projectId: "project_123",
      draft: localDirtyDocument,
      remoteRevision: 1,
      lastSyncedRevision: 1,
      dirty: true,
      lastLocalSaveAt: "2026-03-22T12:00:05.000Z",
      lastSyncedAt: "2026-03-22T12:00:00.000Z",
      pendingSyncAt: "2026-03-22T12:00:05.000Z",
    });

    const replaceDraftStateFromDocument = vi.fn(
      (doc: ProjectDraftDocument, options?: { hasUnsyncedChanges?: boolean }) => {
        expect(doc.title).toBe("Local Draft");
        expect(options?.hasUnsyncedChanges).toBe(true);
      },
    );

    const { result } = renderHook(() => {
      const draftRef = useRef(makeDraft());
      const draftVersionRef = useRef(0);
      const hasUnsyncedChangesRef = useRef(false);

      return useEditorPersistence({
        projectId: "project_123",
        initialDraftRevision: 0,
        initialUpdatedAt: "2026-03-22T12:00:00.000Z",
        draftRef,
        draftVersionRef,
        hasUnsyncedChangesRef,
        replaceDraftStateFromDocument,
      });
    });

    await waitFor(() => {
      expect(result.current.persistenceReadyRef.current).toBe(true);
      expect(result.current.remoteSyncState).toBe("idle");
    });

    expect(replaceDraftStateFromDocument).toHaveBeenCalledWith(
      localDirtyDocument,
      expect.objectContaining({ clearHistory: true, hasUnsyncedChanges: true }),
    );
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("treats a successful save as metadata-only and keeps local state authoritative", async () => {
    const replaceDraftStateFromDocument = vi.fn();
    const draftRef = { current: makeDraft("Live Draft") };
    const draftVersionRef = { current: 0 };
    const hasUnsyncedChangesRef = { current: false };

    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({
        ok: true,
        draft: makeDocument("Server Draft"),
        manifest: { project: { title: "Server Draft" }, sections: [] },
        project: { id: "project_123" },
        revision: 2,
        updatedAt: "2026-03-22T12:00:05.000Z",
      }),
    );

    const { result } = renderHook(() =>
      useEditorPersistence({
        projectId: "project_123",
        initialDraftRevision: 1,
        initialUpdatedAt: "2026-03-22T12:00:00.000Z",
        draftRef,
        draftVersionRef,
        hasUnsyncedChangesRef,
        replaceDraftStateFromDocument,
      }),
    );

    await waitFor(() => {
      expect(result.current.persistenceReadyRef.current).toBe(true);
    });

    await act(async () => {
      hasUnsyncedChangesRef.current = true;
      result.current.setHasUnsyncedChanges(true);
      const didFlush = await result.current.flushRemoteSync();
      expect(didFlush).toBe(true);
    });

    expect(result.current.remoteSyncState).toBe("synced");
    expect(result.current.lastSyncedRevisionRef.current).toBe(2);
    expect(replaceDraftStateFromDocument).not.toHaveBeenCalled();
    expect(draftRef.current.title).toBe("Live Draft");
  });

  it("backs off and retries remote sync when save is retryable", async () => {
    const draftRef = { current: makeDraft("Retry Draft") };
    const draftVersionRef = { current: 0 };
    const hasUnsyncedChangesRef = { current: false };

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse(
          {
            error: "Draft temporarily unavailable",
            code: "draft_unavailable",
            retryable: true,
          },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          revision: 3,
          updatedAt: "2026-03-22T12:00:08.000Z",
        }),
      );

    const { result } = renderHook(() =>
      useEditorPersistence({
        projectId: "project_123",
        initialDraftRevision: 1,
        initialUpdatedAt: "2026-03-22T12:00:00.000Z",
        draftRef,
        draftVersionRef,
        hasUnsyncedChangesRef,
        replaceDraftStateFromDocument: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.persistenceReadyRef.current).toBe(true);
    });

    await act(async () => {
      hasUnsyncedChangesRef.current = true;
      result.current.setHasUnsyncedChanges(true);
      const didFlush = await result.current.flushRemoteSync();
      expect(didFlush).toBe(false);
    });

    expect(result.current.remoteSyncState).toBe("idle");

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1900));
    });

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
      expect(result.current.remoteSyncState).toBe("synced");
      expect(result.current.lastSyncedRevisionRef.current).toBe(3);
    });
  });

  it("retries local state against the canonical remote revision after a conflict", async () => {
    const localDocument = makeDocument("Local Draft");
    const replaceDraftStateFromDocument = vi.fn();
    const draftRef = { current: documentToEditorDraft(localDocument) };
    const draftVersionRef = { current: 1 };
    const hasUnsyncedChangesRef = { current: false };

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse(
          {
            conflict: true,
            draft: makeDocument("Remote Draft"),
            manifest: { project: { title: "Remote Draft" }, sections: [] },
            project: { id: "project_123" },
            revision: 2,
            updatedAt: "2026-03-22T12:00:30.000Z",
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          draft: localDocument,
          revision: 3,
          updatedAt: "2026-03-22T12:00:32.000Z",
        }),
      );

    const { result } = renderHook(() =>
      useEditorPersistence({
        projectId: "project_123",
        initialDraftRevision: 1,
        initialUpdatedAt: "2026-03-22T12:00:00.000Z",
        draftRef,
        draftVersionRef,
        hasUnsyncedChangesRef,
        replaceDraftStateFromDocument,
      }),
    );

    await waitFor(() => {
      expect(result.current.persistenceReadyRef.current).toBe(true);
    });

    await act(async () => {
      hasUnsyncedChangesRef.current = true;
      result.current.setHasUnsyncedChanges(true);
      const didFlush = await result.current.flushRemoteSync();
      expect(didFlush).toBe(false);
    });

    expect(result.current.remoteSyncState).toBe("idle");
    expect(result.current.lastSyncedRevisionRef.current).toBe(2);
    expect(replaceDraftStateFromDocument).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    });

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
      expect(result.current.remoteSyncState).toBe("synced");
      expect(result.current.lastSyncedRevisionRef.current).toBe(3);
    });

    const patchBodies = vi
      .mocked(fetch)
      .mock.calls
      .map((call) => JSON.parse(String((call[1] as RequestInit | undefined)?.body)));
    expect(patchBodies[0]?.baseRevision).toBe(1);
    expect(patchBodies[1]?.baseRevision).toBe(2);
    expect(draftRef.current.title).toBe("Local Draft");
  });
});
