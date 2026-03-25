export type ProcessingJobSummary = {
  id: string;
  status: string;
  failureReason: string | null;
};

export function isActiveProcessingJobStatus(status: string) {
  return status === "queued" || status === "running";
}

export function hasActiveProcessingJobs(
  jobs?: ProcessingJobSummary[] | null,
) {
  return (jobs ?? []).some((job) => isActiveProcessingJobStatus(job.status));
}
