"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Film } from "lucide-react";
import Uppy from "@uppy/core";
import DashboardView from "@uppy/react/dashboard";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EditorPanel } from "./editor-shell";

const defaultStatus =
  "Select a source video. MotionRoll will validate the file, register the upload, and queue sequence processing separately from scene editing.";

export function UploadPanel({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const [status, setStatus] = useState(defaultStatus);
  const inputId = useId();
  const panelInputId = `${inputId}-panel`;

  const uppy = useMemo(
    () =>
      new Uppy({
        autoProceed: true,
        restrictions: {
          maxNumberOfFiles: 1,
          allowedFileTypes: [".mp4", ".mov", ".webm", ".m4v"],
          maxFileSize: 524288000,
        },
      }),
    [],
  );

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

  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) {
      void handleUpload(file);
    }
    event.currentTarget.value = "";
  }

  function renderChooser(id: string) {
    return (
      <div>
        <input
          id={id}
          type="file"
          accept=".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm"
          className="sr-only"
          onChange={handleFileSelection}
        />
        <Button type="button" variant="secondary" className="h-9 px-4" asChild>
          <label htmlFor={id}>Choose video</label>
        </Button>
      </div>
    );
  }

  const dashboardLocale = {
    strings: {
      dropPasteFiles: "Drag and drop videos here",
      dropPasteFolders: "Drag and drop videos here",
      dropPasteBoth: "Drag and drop videos here",
      dropPasteImportFiles: "Drag and drop videos here",
      dropPasteImportFolders: "Drag and drop videos here",
      dropPasteImportBoth: "Drag and drop videos here",
    },
  } as const;

  function renderDropzone() {
    return (
      <div className="motionroll-uppy relative">
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-4 text-center text-sm font-medium text-[var(--foreground-soft)]">
          Drag and drop videos here
        </div>
        <DashboardView
          uppy={uppy}
          proudlyDisplayPoweredByUppy={false}
          hideProgressDetails
          locale={dashboardLocale}
          height={160}
        />
      </div>
    );
  }

  const embeddedContent = (
    <>
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-[rgba(199,241,251,0.14)] text-[var(--accent)]">
          <Film className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Video format supported</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--foreground-muted)" }}>
            MP4, MOV, WEBM, M4V - 500 MB max
          </p>
        </div>
      </div>
      {renderChooser(inputId)}
      {renderDropzone()}
      {status && status !== defaultStatus ? (
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          {status}
        </p>
      ) : null}
    </>
  );

  const panelContent = (
    <>
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-bg)]">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-[rgba(199,241,251,0.14)] text-[var(--accent)]">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Video format supported</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--foreground-muted)" }}>
              MP4, MOV, WEBM, M4V - 500 MB max
            </p>
          </div>
        </div>
        <div className="px-3 pb-1 pt-3">{renderChooser(panelInputId)}</div>
        <div className="px-3 py-3">
          {renderDropzone()}
        </div>
      </div>
      {status && status !== defaultStatus ? (
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          {status}
        </p>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{embeddedContent}</div>;
  }

  return (
    <EditorPanel
      title="Video format supported"
      badge={<Badge variant="accent">MP4 / MOV / WEBM / Max 500 MB</Badge>}
    >
      {panelContent}
    </EditorPanel>
  );
}
