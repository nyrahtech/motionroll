"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { EditorFormValues } from "./editor-types";
import type { TimelineClipModel, TimelineSelection } from "./timeline-model";
import { EditorInspector, InspectorGroup } from "./editor-shell";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

export function SelectionDetailsPanel({
  selection,
  selectedClip,
  form,
  onClose,
}: {
  selection: TimelineSelection;
  selectedClip?: TimelineClipModel;
  form: UseFormReturn<EditorFormValues>;
  onClose: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!selection || !selectedClip) {
    return (
      <EditorInspector title="Details" subtitle="Select a block to edit its content and timing.">
        <div className="rounded-[12px] bg-[#0c1016] p-4 text-sm text-[var(--foreground-muted)]">
          Pick a timeline block to edit it here.
        </div>
      </EditorInspector>
    );
  }

  const isSection = selection.trackType === "section";
  const isCta = false;
  const isStep = false;
  const isText = selection.trackType === "layer";
  const label = isSection ? "Section" : isCta ? "CTA" : isStep ? "Step" : "Text";

  return (
    <EditorInspector title="Details" subtitle="Only the essentials are visible first.">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="accent">{label}</Badge>
          <span className="min-w-0 truncate text-sm text-white">{selectedClip.label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring rounded-[8px] p-1 text-[var(--foreground-faint)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <InspectorGroup
          title={isSection ? "Main section" : isCta ? "Call to action" : "Selected block"}
          description={
            isSection
              ? "Adjust the overall range and title."
              : isCta
                ? "Edit the CTA copy, link, and timing."
                : "Edit the copy and timing for the selected block."
          }
        >
          <div className="space-y-2.5">
            {isSection ? (
              <label className="space-y-1.5">
                <span className="field-label">Project title</span>
                <Input {...form.register("title")} />
              </label>
            ) : null}

            {isSection ? (
              <label className="space-y-1.5">
                <span className="field-label">Section title</span>
                <Input {...form.register("sectionTitle")} />
              </label>
            ) : null}

            {isText || isStep ? (
              <>
                <label className="space-y-1.5">
                  <span className="field-label">Text</span>
                  <Textarea {...form.register("text")} />
                </label>
              </>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="field-label">{isSection ? "Start frame" : "Start"}</span>
                <Input
                  type="number"
                  step={isSection ? undefined : "0.01"}
                  min="0"
                  {...form.register(isSection ? "frameRangeStart" : "overlayStart", { valueAsNumber: true })}
                />
              </label>
              <label className="space-y-1.5">
                <span className="field-label">{isSection ? "End frame" : "End"}</span>
                <Input
                  type="number"
                  step={isSection ? undefined : "0.01"}
                  min="0"
                  {...form.register(isSection ? "frameRangeEnd" : "overlayEnd", { valueAsNumber: true })}
                />
              </label>
            </div>

            {isCta ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="field-label">CTA label</span>
                  <Input {...form.register("ctaLabel")} />
                </label>
                <label className="space-y-1.5">
                  <span className="field-label">CTA URL</span>
                  <Input {...form.register("ctaHref")} />
                </label>
              </div>
            ) : null}
          </div>
        </InspectorGroup>

        <div className="rounded-[8px] bg-[#0c1016] p-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-2 text-left text-sm text-[var(--foreground-soft)] hover:bg-[rgba(255,255,255,0.05)]"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Advanced motion
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
          {showAdvanced ? (
            <div className="mt-2 grid gap-2 px-2 pb-2">
              <label className="space-y-1.5">
                <span className="field-label">Section height</span>
                <Input type="number" {...form.register("sectionHeightVh", { valueAsNumber: true })} />
              </label>
              <label className="space-y-1.5">
                <span className="field-label">Scrub strength</span>
                <Input type="number" step="0.05" {...form.register("scrubStrength", { valueAsNumber: true })} />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </EditorInspector>
  );
}
