"use client";

import { Clapperboard, LayoutPanelLeft, Maximize2, PanelRightOpen, Save, Upload } from "lucide-react";
import type { PresetId } from "@motionroll/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const presetOptions: Array<{ id: PresetId; label: string }> = [
  { id: "scroll-sequence", label: "Scroll Sequence" },
  { id: "product-reveal", label: "Product Reveal" },
  { id: "feature-walkthrough", label: "Feature Walkthrough" },
  { id: "before-after", label: "Before / After" },
  { id: "device-spin", label: "Device Spin" },
  { id: "chaptered-scroll-story", label: "Chaptered Story" },
];

export function EditorToolbar({
  title,
  presetId,
  saveState,
  browserOpen,
  detailsOpen,
  onPresetChange,
  onToggleBrowser,
  onToggleDetails,
  onFullscreen,
  onPublish,
  onSave,
}: {
  title: string;
  presetId: PresetId;
  saveState: string;
  browserOpen: boolean;
  detailsOpen: boolean;
  onPresetChange: (presetId: PresetId) => void;
  onToggleBrowser: () => void;
  onToggleDetails: () => void;
  onFullscreen: () => void;
  onPublish: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-between gap-2 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        <div className="hidden h-4 w-px bg-[rgba(255,255,255,0.08)] sm:block" />
        <label className="hidden items-center gap-2 rounded-[7px] bg-[rgba(255,255,255,0.04)] px-2 py-1 text-xs text-[var(--foreground-soft)] sm:flex">
          <Clapperboard className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
          <Select value={presetId} onValueChange={(value) => onPresetChange(value as PresetId)}>
            <SelectTrigger
              size="sm"
              className="h-7 min-w-[180px] border-0 bg-transparent px-1.5 text-xs text-[var(--foreground-soft)] shadow-none focus:ring-0"
              aria-label="Choose preset"
            >
              <SelectValue placeholder="Choose preset" />
            </SelectTrigger>
            <SelectContent>
              {presetOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <Button type="button" variant={browserOpen ? "secondary" : "quiet"} size="icon" onClick={onToggleBrowser} title={browserOpen ? "Hide browser" : "Show browser"} aria-label={browserOpen ? "Hide browser" : "Show browser"}>
          <LayoutPanelLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant={detailsOpen ? "secondary" : "quiet"} size="icon" onClick={onToggleDetails} title={detailsOpen ? "Hide details" : "Show details"} aria-label={detailsOpen ? "Hide details" : "Show details"}>
          <PanelRightOpen className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="quiet" size="icon" onClick={onFullscreen} title="Open fullscreen preview" aria-label="Open fullscreen preview">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onPublish}>
          <Upload className="h-3.5 w-3.5" />
          Publish
        </Button>
        <Button type="button" size="sm" onClick={onSave}>
          <Save className="h-3.5 w-3.5" />
          {saveState}
        </Button>
      </div>
    </div>
  );
}
