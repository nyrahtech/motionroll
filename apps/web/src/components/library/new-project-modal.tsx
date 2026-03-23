"use client";

import { useRef, useEffect, useState } from "react";
import { X } from "lucide-react";
import { presetDefinitions } from "@motionroll/shared";
import type { PresetId } from "@motionroll/shared";
import { createProjectAction } from "@/app/actions";
import { getPresetPresentation } from "@/lib/preset-presentation";
import { Badge } from "@/components/ui/badge";

type NewProjectModalProps = {
  open: boolean;
  onClose: () => void;
};

const PRESET_IDS: PresetId[] = [
  "scroll-sequence",
  "product-reveal",
  "feature-walkthrough",
  "before-after",
  "device-spin",
  "chaptered-scroll-story",
];

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetId>("product-reveal");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  // Close on backdrop click
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      onClose();
    }
  }

  const presets = presetDefinitions.filter((p) => PRESET_IDS.includes(p.id as PresetId));

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[16px] border p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      style={{
        background: "var(--editor-panel)",
        borderColor: "var(--editor-border)",
        color: "var(--editor-text)",
      }}
    >
      <div className="flex h-14 items-center justify-between border-b px-6" style={{ borderColor: "var(--editor-border)" }}>
        <span className="text-sm font-semibold">New project</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" style={{ color: "var(--editor-text-dim)" }} />
        </button>
      </div>

      <div className="overflow-y-auto p-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.16em]" style={{ color: "var(--editor-text-dim)" }}>
          Choose a preset
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {presets.map((preset) => {
            const presentation = getPresetPresentation(preset.id);
            const isSelected = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedPreset(preset.id as PresetId)}
                className="group relative flex flex-col overflow-hidden rounded-[12px] border text-left transition-all"
                style={{
                  borderColor: isSelected ? "var(--editor-accent)" : "var(--editor-border)",
                  background: isSelected ? "rgba(103,232,249,0.07)" : "var(--editor-shell)",
                }}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {preset.previewThumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preset.previewThumbnail}
                      alt={preset.label}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="h-full w-full" style={{ background: "var(--editor-border)" }} />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 ring-2 ring-inset ring-[var(--editor-accent)]" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-white">{preset.label}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--editor-text-dim)" }}>
                    {presentation.category}
                  </p>
                </div>
                {preset.id === "product-reveal" && (
                  <div className="absolute right-2 top-2">
                    <Badge variant="accent" className="text-[10px]">Recommended</Badge>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "var(--editor-border)" }}>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-[10px] border px-4 text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          style={{ borderColor: "var(--editor-border)", color: "var(--editor-text-dim)" }}
        >
          Cancel
        </button>
        <form action={createProjectAction}>
          <input type="hidden" name="presetId" value={selectedPreset} />
          <button
            type="submit"
            className="h-9 rounded-[10px] px-5 text-sm font-semibold transition-colors hover:opacity-90"
            style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
          >
            Create project
          </button>
        </form>
      </div>
    </dialog>
  );
}
