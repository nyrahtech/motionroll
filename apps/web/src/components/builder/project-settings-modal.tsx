"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

type SettingsValues = {
  projectTitle: string;
  bookmarkTitle: string;
  frameRangeStart: number;
  frameRangeEnd: number;
  scrubStrength: number;
  sectionHeightVh: number;
};

export function ProjectSettingsModal({
  open,
  onClose,
  values,
  coverUrl,
  hasThumbnailOverride,
  onSave,
  onThumbnailUpload,
  onThumbnailReset,
}: {
  open: boolean;
  onClose: () => void;
  values: SettingsValues;
  coverUrl: string;
  hasThumbnailOverride: boolean;
  onSave: (values: SettingsValues) => Promise<void> | void;
  onThumbnailUpload: (file: File) => Promise<void>;
  onThumbnailReset: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const thumbnailInputId = useId();
  const [draft, setDraft] = useState(values);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  useEffect(() => {
    setDraft(values);
  }, [values]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  function handleDialogClick(event: React.MouseEvent<HTMLDialogElement>) {
    // Only close when the native dialog backdrop itself is clicked.
    // Programmatic clicks (e.g. hidden file input .click()) can bubble here.
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleThumbnailChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setIsUploadingThumbnail(true);
    try {
      await onThumbnailUpload(file);
    } finally {
      setIsUploadingThumbnail(false);
    }
  }

  async function handleThumbnailReset() {
    setIsUploadingThumbnail(true);
    try {
      await onThumbnailReset();
    } finally {
      setIsUploadingThumbnail(false);
    }
  }

  function handleUploadThumbnailClick() {
    // Clicking a <label htmlFor="file"> causes the browser to focus the input,
    // which can auto-scroll the nearest overflow container. Preserve scrollTop.
    pendingScrollRestoreRef.current = scrollRef.current?.scrollTop ?? null;
    thumbnailInputRef.current?.click();
    requestAnimationFrame(() => {
      if (pendingScrollRestoreRef.current == null) return;
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = null;
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      onClose={onClose}
      className={
        open
          ? "m-auto flex max-h-[80vh] w-[min(520px,calc(100vw-24px))] flex-col overflow-hidden rounded-[16px] border p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          : "m-auto hidden max-h-[80vh] w-[min(720px,calc(100vw-24px))] flex-col overflow-hidden rounded-[16px] border p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      }
      style={{
        background: "var(--editor-panel)",
        borderColor: "var(--editor-border)",
        color: "var(--editor-text)",
      }}
    >
      <div className="flex h-16 items-center justify-between border-b px-6 py-3" style={{ borderColor: "var(--editor-border)" }}>
        <span className="text-lg font-semibold">Project settings</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" style={{ color: "var(--editor-text-dim)" }} />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs text-[var(--foreground-muted)]">Project title</label>
              <Input
                aria-label="Project title"
                value={draft.projectTitle}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, projectTitle: value }));
                }}
              />
            </div>

           
            <div className="space-y-3">
              <p className="text-xs text-[var(--foreground-muted)]">Thumbnail</p>
              <div className="relative aspect-[16/9] overflow-hidden rounded-[12px] border border-[var(--editor-border)] bg-[var(--editor-shell)]">
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="Project thumbnail preview" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  id={thumbnailInputId}
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleThumbnailChange}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUploadingThumbnail}
                  onClick={handleUploadThumbnailClick}
                >
                  {isUploadingThumbnail ? "Uploading..." : "Upload thumbnail"}
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  disabled={!hasThumbnailOverride || isUploadingThumbnail}
                  onClick={() => void handleThumbnailReset()}
                >
                  Remove override
                </Button>
              </div>
            </div>
          </section>

          <div className="h-px w-full bg-[var(--editor-border)]" />

          <section className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
              Canvas
            </p>
            <div className="space-y-2">
              <label className="block text-xs text-[var(--foreground-muted)]">Bookmark label</label>
              <Input
                aria-label="Bookmark label"
                value={draft.bookmarkTitle}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, bookmarkTitle: value }));
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-xs text-[var(--foreground-muted)]">Frame range start</label>
                <Input
                  aria-label="Frame range start"
                  type="number"
                  value={draft.frameRangeStart}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((current) => ({
                      ...current,
                      frameRangeStart: Number(value),
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-[var(--foreground-muted)]">Frame range end</label>
                <Input
                  aria-label="Frame range end"
                  type="number"
                  value={draft.frameRangeEnd}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((current) => ({
                      ...current,
                      frameRangeEnd: Number(value),
                    }));
                  }}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--foreground-muted)]">
                  <span>Scroll strength</span>
                  <span>{draft.scrubStrength.toFixed(2)}x</span>
                </div>
                <Slider
                  value={[draft.scrubStrength]}
                  min={0.2}
                  max={2}
                  step={0.05}
                  onValueChange={([value]) =>
                    setDraft((current) => ({
                      ...current,
                      scrubStrength: value ?? current.scrubStrength,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--foreground-muted)]">
                  <span>Canvas scroll height</span>
                  <span>{Math.round(draft.sectionHeightVh)}vh</span>
                </div>
                <Slider
                  value={[draft.sectionHeightVh]}
                  min={120}
                  max={500}
                  step={10}
                  onValueChange={([value]) =>
                    setDraft((current) => ({
                      ...current,
                      sectionHeightVh: value ?? current.sectionHeightVh,
                    }))
                  }
                />
              </div>
            </div>
          </section>

        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "var(--editor-border)" }}>
        <Button type="button" variant="quiet" onClick={onClose} disabled={isSaving || isUploadingThumbnail}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving || isUploadingThumbnail}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </dialog>
  );
}
