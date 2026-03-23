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

  it("keeps remote sync idle when initial draft hydration is retryable", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse(
        {
          error: "Draft temporarily unavailable",
          code: "draft_unavailable",
          retryable: true,
        },
        { status: 503 },
      ),
    );

    const replaceDraftStateFromDocument = vi.fn();
    const setProjectStateFromResponse = vi.fn();
    const setManifestStateFromResponse = vi.fn();

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
        setProjectStateFromResponse,
        setManifestStateFromResponse,
      });
    });

    await waitFor(() => {
      expect(result.current.persistenceReadyRef.current).toBe(true);
      expect(result.current.remoteSyncState).toBe("idle");
    });

    expect(replaceDraftStateFromDocument).not.toHaveBeenCalled();
    expect(setProjectStateFromResponse).not.toHaveBeenCalled();
    expect(setManifestStateFromResponse).not.toHaveBeenCalled();
  });

  it("backs off and retries remote sync when the draft service is retryable", async () => {
    const syncedDocument = makeDocument("Draft Project");

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          draft: syncedDocument,
          manifest: { project: { title: "Draft Project" }, sections: [] },
          project: { id: "project_123" },
          revision: 1,
          updatedAt: "2026-03-22T12:00:00.000Z",
        }),
      )
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
          draft: syncedDocument,
          manifest: { project: { title: "Draft Project" }, sections: [] },
          project: { id: "project_123" },
          revision: 2,
          updatedAt: "2026-03-22T12:00:05.000Z",
        }),
      );

    const replaceDraftStateFromDocument = vi.fn();
    const setProjectStateFromResponse = vi.fn();
    const setManifestStateFromResponse = vi.fn();
    const hasUnsyncedChangesRef = { current: false };
    const draftRef = { current: makeDraft() };
    const draftVersionRef = { current: 0 };

    const { result } = renderHook(() =>
      useEditorPersistence({
        projectId: "project_123",
        initialDraftRevision: 0,
        initialUpdatedAt: "2026-03-22T12:00:00.000Z",
        draftRef,
        draftVersionRef,
        hasUnsyncedChangesRef,
        replaceDraftStateFromDocument,
        setProjectStateFromResponse,
        setManifestStateFromResponse,
      }),
    );

    await waitFor(() => {
      expect(result.current.persistenceReadyRef.current).toBe(true);
      expect(result.current.remoteSyncState).toBe("synced");
    });

    await act(async () => {
      hasUnsyncedChangesRef.current = true;
      result.current.setHasUnsyncedChanges(true);
    });

    await act(async () => {
      const didFlush = await result.current.flushRemoteSync();
      expect(didFlush).toBe(false);
    });

    expect(result.current.remoteSyncState).toBe("idle");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1900));
    });

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
      expect(result.current.remoteSyncState).toBe("synced");
    });
  });

  it("reschedules sync after hydrating a dirty local draft when remote hydration is retryable", async () => {
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
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

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
          draft: localDirtyDocument,
          manifest: { project: { title: "Local Draft" }, sections: [] },
          project: { id: "project_123" },
          revision: 2,
          updatedAt: "2026-03-22T12:00:10.000Z",
        }),
      );

    const setProjectStateFromResponse = vi.fn();
    const setManifestStateFromResponse = vi.fn();
    const hasUnsyncedChangesRef = { current: false };
    const draftRef = { current: makeDraft() };
    const draftVersionRef = { current: 0 };
    const replaceDraftStateFromDocument = vi.fn(
      (doc: ProjectDraftDocument, options?: { hasUnsyncedChanges?: boolean }) => {
        draftRef.current = documentToEditorDraft(doc);
        if (typeof options?.hasUnsyncedChanges === "boolean") {
          hasUnsyncedChangesRef.current = options.hasUnsyncedChanges;
        }
      },
    );

    const { result } = renderHook(() =>
      useEditorPersistence({
        projectId: "project_123",
        initialDraftRevision: 0,
        initialUpdatedAt: "2026-03-22T12:00:00.000Z",
        draftRef,
        draftVersionRef,
        hasUnsyncedChangesRef,
        replaceDraftStateFromDocument,
        setProjectStateFromResponse,
        setManifestStateFromResponse,
      }),
    );

    await waitFor(() => {
      expect(result.current.persistenceReadyRef.current).toBe(true);
      expect(result.current.remoteSyncState).toBe("idle");
    });

    expect(replaceDraftStateFromDocument).toHaveBeenCalledWith(
      localDirtyDocument,
      expect.objectContaining({ clearHistory: true, hasUnsyncedChanges: true }),
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    expect(setTimeoutSpy.mock.calls.some((call) => call[1] === 1800)).toBe(true);
    setTimeoutSpy.mockRestore();
  });

  it("retries with the canonical remote revision after a draft conflict", async () => {
    const initialDocument = makeDocument("Draft Project");
    const localDocument = makeDocument("Local Draft");

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          draft: initialDocument,
          manifest: { project: { title: "Draft Project" }, sections: [] },
          project: { id: "project_123" },
          revision: 1,
          updatedAt: "2026-03-22T12:00:00.000Z",
        }),
      )
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
          manifest: { project: { title: "Local Draft" }, sections: [] },
          project: { id: "project_123" },
          revision: 3,
          updatedAt: "2026-03-22T12:00:32.000Z",
        }),
      );

    const setProjectStateFromResponse = vi.fn();
    const setManifestStateFromResponse = vi.fn();
    const replaceDraftStateFromDocument = vi.fn();
    const hasUnsyncedChangesRef = { current: false };
    const draftRef = { current: makeDraft() };
    const draftVersionRef = { current: 0 };

    const { result } = renderHook(() =>
      useEditorPersistence({
        projectId: "project_123",
        initialDraftRevision: 0,
        initialUpdatedAt: "2026-03-22T12:00:00.000Z",
        draftRef,
        draftVersionRef,
        hasUnsyncedChangesRef,
        replaceDraftStateFromDocument,
        setProjectStateFromResponse,
        setManifestStateFromResponse,
      }),
    );

    await waitFor(() => {
      expect(result.current.persistenceReadyRef.current).toBe(true);
      expect(result.current.remoteSyncState).toBe("synced");
    });

    await act(async () => {
      draftRef.current = documentToEditorDraft(localDocument);
      draftVersionRef.current = 1;
      hasUnsyncedChangesRef.current = true;
      result.current.setHasUnsyncedChanges(true);
    });

    await act(async () => {
      const didFlush = await result.current.flushRemoteSync();
      expect(didFlush).toBe(false);
    });

    expect(result.current.remoteSyncState).toBe("idle");
    expect(result.current.lastSyncedRevisionRef.current).toBe(2);
    expect(replaceDraftStateFromDocument).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Remote Draft" }),
      expect.anything(),
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    });

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
      expect(result.current.remoteSyncState).toBe("synced");
      expect(result.current.lastSyncedRevisionRef.current).toBe(3);
    });

    const patchBodies = vi
      .mocked(fetch)
      .mock.calls
      .slice(1)
      .map((call) => JSON.parse(String((call[1] as RequestInit | undefined)?.body)));
    expect(patchBodies[0]?.baseRevision).toBe(1);
    expect(patchBodies[1]?.baseRevision).toBe(2);
    expect(setProjectStateFromResponse).toHaveBeenCalledWith({ id: "project_123" });
    expect(setManifestStateFromResponse).toHaveBeenCalledWith({
      project: { title: "Local Draft" },
      sections: [],
    });
  });
});
