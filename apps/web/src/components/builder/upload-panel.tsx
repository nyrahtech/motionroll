"use client";

import { useEffect, useMemo, useState } from "react";
import { Film } from "lucide-react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import DashboardView from "@uppy/react/dashboard";
import { StatusRow } from "@/components/motionroll/surfaces";
import { Badge } from "@/components/ui/badge";
import { EditorPanel } from "./editor-shell";

export function UploadPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState(
    "Select a source video and MotionRoll will validate it before registering the upload and processing job.",
  );

  const uppy = useMemo(() => {
    const instance = new Uppy({
      autoProceed: true,
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: [".mp4", ".mov", ".webm", ".m4v"],
        maxFileSize: 524288000,
      },
    });

    instance.use(Dashboard, {
      inline: true,
      proudlyDisplayPoweredByUppy: false,
      hideProgressDetails: true,
      note: "Video only · MP4, MOV, WEBM, M4V · Max 500 MB",
      height: 180,
    });

    return instance;
  }, []);

  useEffect(() => {
    const onFileAdded = (file: { data?: unknown }) => {
      if (file.data instanceof File) {
        void handleUpload(file.data);
      }
    };

    uppy.on("file-added", onFileAdded);
    return () => {
      uppy.off("file-added", onFileAdded);
      uppy.cancelAll();
      uppy.destroy();
    };
  }, [uppy]);

  async function handleUpload(file: File) {
    setStatus("Validating video...");
    const registrationResponse = await fetch("/api/uploads/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        bytes: file.size,
        sourceType: "video",
        sourceOrigin: "upload",
      }),
    });

    if (!registrationResponse.ok) {
      const error = (await registrationResponse
        .json()
        .catch(() => ({ error: "Upload validation failed." }))) as {
        error?: string;
      };
      setStatus(error.error ?? "Upload validation failed.");
      return;
    }

    const registration = await registrationResponse.json();
    setStatus("Uploading source video...");
    const uploadResponse = await fetch(registration.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      setStatus("Direct upload failed. Check local object storage and CORS.");
      return;
    }

    setStatus("Enqueuing processing...");
    const enqueueResponse = await fetch(registration.next.url, {
      method: registration.next.method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registration.next.body),
    });

    if (!enqueueResponse.ok) {
      setStatus("Upload succeeded, but processing enqueue failed.");
      return;
    }

    setStatus("Video upload complete. Processing job queued.");
  }

  return (
    <EditorPanel
      title="Upload source video"
      description="Upload one clip and keep the rest of the pipeline automatic."
      badge={<Badge variant="accent">Video only</Badge>}
    >
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-bg)]">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-[rgba(199,241,251,0.14)] text-[var(--accent)]">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Direct upload</p>
            <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
              Supported formats: MP4, MOV, WEBM, and M4V.
            </p>
          </div>
        </div>
        <div className="motionroll-uppy px-3 py-3">
          <DashboardView uppy={uppy} />
        </div>
      </div>
      <div className="space-y-1">
        <StatusRow label="Flow" value="Uppy -> validate -> upload -> enqueue" />
        <StatusRow label="Retention" value="Delete after success by default" />
      </div>
      <p className="text-sm leading-6 text-[var(--foreground-muted)]">{status}</p>
    </EditorPanel>
  );
}
