"use client";

import type { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EditorFormValues, InspectorTab } from "./editor-types";
import {
  EditorInspector,
  EditorPanel,
  EditorSectionTabs,
  InspectorGroup,
} from "./editor-shell";

const inspectorTabs = ["content", "playback", "preset"] as const satisfies readonly InspectorTab[];
const selectClassName =
  "focus-ring flex h-11 w-full rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm text-[var(--foreground)]";

export function InspectorPane({
  tab,
  onTabChange,
  form,
  selectedOverlay,
  preset,
  showAdvanced,
  onToggleAdvanced,
  presetOptions,
}: {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  form: UseFormReturn<EditorFormValues>;
  selectedOverlay?: {
    id: string;
    content: { text?: string };
  };
  preset: {
    id: string;
    label: string;
    description: string;
    exposedControls: Array<{ id: string; label: string }>;
    advancedControls?: Array<{ id: string; label: string }>;
  };
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  presetOptions: Array<{ id: string; label: string }>;
}) {
  return (
    <EditorInspector
      title={tab === "content" ? "Content" : tab === "playback" ? "Playback" : "Preset"}
      subtitle={
        tab === "content"
          ? "Core copy and selected beat timing."
          : tab === "playback"
            ? "Section pacing, frame range, and runtime behavior."
            : "Preset context without extra clutter."
      }
    >
      <div className="space-y-4">
        <EditorSectionTabs tabs={inspectorTabs} active={tab} onChange={onTabChange} />

        {tab === "content" ? (
          <>
            <InspectorGroup
              title="Section copy"
              description="Keep the writing close to the current section and selected overlay."
            >
              <div className="grid gap-3">
                <label className="space-y-2">
                  <span className="field-label">Project title</span>
                  <Input {...form.register("title")} />
                </label>
                <label className="space-y-2">
                  <span className="field-label">Section title</span>
                  <Input {...form.register("sectionTitle")} />
                </label>
                <label className="space-y-2">
                  <span className="field-label">Text</span>
                  <Textarea {...form.register("text")} />
                </label>
              </div>
            </InspectorGroup>

            <InspectorGroup
              title="Call to action"
              description="Use one clear conversion beat near the end of the section."
            >
              <div className="grid gap-3">
                <label className="space-y-2">
                  <span className="field-label">CTA label</span>
                  <Input {...form.register("ctaLabel")} />
                </label>
                <label className="space-y-2">
                  <span className="field-label">CTA URL</span>
                  <Input {...form.register("ctaHref")} />
                </label>
              </div>
            </InspectorGroup>

            {selectedOverlay ? (
              <InspectorGroup
                title="Selected overlay"
                description={`Adjust timing for "${selectedOverlay.content.text ?? "Text"}".`}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="field-label">Start</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      {...form.register("overlayStart", { valueAsNumber: true })}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="field-label">End</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      {...form.register("overlayEnd", { valueAsNumber: true })}
                    />
                  </label>
                </div>
              </InspectorGroup>
            ) : null}
          </>
        ) : null}

        {tab === "playback" ? (
          <>
            <InspectorGroup
              title="Section pacing"
              description="These settings should influence the motion without overwhelming the workspace."
            >
              <div className="grid gap-3">
                <label className="space-y-2">
                  <span className="field-label">Section height (vh)</span>
                  <Input type="number" {...form.register("sectionHeightVh", { valueAsNumber: true })} />
                </label>
                <label className="space-y-2">
                  <span className="field-label">Scrub strength</span>
                  <Input type="number" step="0.05" {...form.register("scrubStrength", { valueAsNumber: true })} />
                </label>
              </div>
            </InspectorGroup>

            <InspectorGroup
              title="Frame mapping"
              description="Trim to the exact beat you want the runtime to play."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="field-label">Start frame</span>
                  <Input type="number" {...form.register("frameRangeStart", { valueAsNumber: true })} />
                </label>
                <label className="space-y-2">
                  <span className="field-label">End frame</span>
                  <Input type="number" {...form.register("frameRangeEnd", { valueAsNumber: true })} />
                </label>
              </div>
            </InspectorGroup>

            <EditorPanel
              title="Advanced runtime"
              description="Hidden by default so the workspace stays calm."
              badge={
                <button
                  type="button"
                  onClick={onToggleAdvanced}
                  className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-faint)]"
                >
                  {showAdvanced ? "Hide" : "Show"}
                </button>
              }
            >
              {showAdvanced ? (
                <div className="flex flex-wrap gap-2">
                  {(preset.advancedControls ?? []).map((control) => (
                    <Badge key={control.id} variant="quiet">
                      {control.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-[var(--foreground-muted)]">
                  Motion easing, pinning, and preload behavior stay available without competing
                  with the primary editing controls.
                </p>
              )}
            </EditorPanel>
          </>
        ) : null}

        {tab === "preset" ? (
          <>
            <InspectorGroup title={preset.label} description={preset.description}>
              <div className="flex flex-wrap gap-2">
                {preset.exposedControls.map((control) => (
                  <Badge key={control.id} variant="quiet">
                    {control.label}
                  </Badge>
                ))}
              </div>
            </InspectorGroup>
            <InspectorGroup
              title="Preset selection"
              description="Switch the preset here, then save to apply the new structure."
            >
              <label className="space-y-2">
                <span className="field-label">Preset</span>
                <select className={selectClassName} {...form.register("presetId")}>
                  {presetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </InspectorGroup>
          </>
        ) : null}
      </div>
    </EditorInspector>
  );
}
