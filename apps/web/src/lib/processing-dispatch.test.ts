import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const processSourceAssetMock = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    INNGEST_EVENT_KEY: "local-dev-key",
  },
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: sendMock,
  },
}));

vi.mock("@/lib/processing/pipeline", () => ({
  processSourceAsset: processSourceAssetMock,
}));

describe("processing dispatch", () => {
  beforeEach(() => {
    sendMock.mockReset();
    processSourceAssetMock.mockReset();
  });

  it("processes inline when the local placeholder Inngest key is still configured", async () => {
    const { dispatchProcessingJob } = await import("./processing-dispatch");
    const result = await dispatchProcessingJob("job-1", {
      projectId: "project-1",
      assetId: "asset-1",
      sourceType: "video",
      sourceOrigin: "upload",
      retentionPolicy: "keep_source",
      outputTargets: ["frames", "poster", "fallback_video", "manifest_fragment"],
    });

    expect(result.mode).toBe("inline");
    expect(processSourceAssetMock).toHaveBeenCalledWith("job-1", expect.any(Object));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("falls back to inline processing when Inngest rejects the event key", async () => {
    vi.resetModules();

    vi.doMock("@/lib/env", () => ({
      env: {
        INNGEST_EVENT_KEY: "real-looking-key",
      },
    }));

    const retryingSendMock = vi.fn().mockRejectedValue(new Error("Inngest API Error: 401 Event key not found"));
    const retryingProcessMock = vi.fn();

    vi.doMock("@/lib/inngest", () => ({
      inngest: {
        send: retryingSendMock,
      },
    }));

    vi.doMock("@/lib/processing/pipeline", () => ({
      processSourceAsset: retryingProcessMock,
    }));

    const { dispatchProcessingJob } = await import("./processing-dispatch");
    const result = await dispatchProcessingJob("job-2", {
      projectId: "project-2",
      assetId: "asset-2",
      sourceType: "video",
      sourceOrigin: "upload",
      retentionPolicy: "delete_after_success",
      outputTargets: ["frames", "poster", "fallback_video", "manifest_fragment"],
    });

    expect(result.mode).toBe("inline");
    expect(retryingSendMock).toHaveBeenCalledTimes(1);
    expect(retryingProcessMock).toHaveBeenCalledWith("job-2", expect.any(Object));
  });
});
