import { describe, expect, it } from "vitest";
import {
  hasActiveProcessingJobs,
  isActiveProcessingJobStatus,
} from "./processing-jobs";

describe("processing job helpers", () => {
  it("treats queued and running jobs as active", () => {
    expect(isActiveProcessingJobStatus("queued")).toBe(true);
    expect(isActiveProcessingJobStatus("running")).toBe(true);
  });

  it("ignores completed and failed jobs", () => {
    expect(isActiveProcessingJobStatus("completed")).toBe(false);
    expect(isActiveProcessingJobStatus("failed")).toBe(false);
  });

  it("detects whether any active processing job remains", () => {
    expect(
      hasActiveProcessingJobs([
        { id: "job-1", status: "completed", failureReason: null },
        { id: "job-2", status: "running", failureReason: null },
      ]),
    ).toBe(true);

    expect(
      hasActiveProcessingJobs([
        { id: "job-1", status: "completed", failureReason: null },
        { id: "job-2", status: "failed", failureReason: "boom" },
      ]),
    ).toBe(false);
  });
});
