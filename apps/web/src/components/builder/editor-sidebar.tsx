"use client";

import React, { type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Film,
  ImagePlus,
  Italic,
  Sparkles,
  Type,
  Underline,
} from "lucide-react";
import type { OverlayDefinition } from "@motionroll/shared";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ProviderPanel } from "./provider-panel";
import { UploadPanel } from "./upload-panel";

export type SidebarContext = "insert" | "upload" | "ai" | "edit";

type SidebarPanelProps = {
  projectId: string;
  activeContext: SidebarContext;
  selectedOverlay?: OverlayDefinition;
  onContextChange: (context: SidebarContext) => void;
  onOverlayFieldChange: (field: string, value: string | number) => void;
  onOverlayStyleChange: (field: string, value: string | number | boolean) => void;
  onOverlayStyleLiveChange?: (field: string, value: string | number) => void;
  onOverlayAnimationChange: (field: string, value: string | number) => void;
  onOverlayTransitionChange: (field: string, value: string | number) => void;
  onAddContent: (type: string) => void;
};

const numberInputClassName = "h-9 rounded-[12px]";
const groupButtonClassName =
  "focus-ring inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--foreground-muted)] transition-colors";
const inactiveGroupButtonClassName = "hover:bg-[rgba(255,255,255,0.05)] hover:text-white";
const activeGroupButtonClassName = "bg-[rgba(205,239,255,0.12)] text-white";

function formatPercent(value: number) {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
      {children}
    </p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ActionButton({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex h-11 items-center gap-2 rounded-[14px] border px-3 text-sm transition-colors",
        active
          ? "border-[rgba(205,239,255,0.28)] bg-[rgba(205,239,255,0.12)] text-white"
          : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)] hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)]",
      )}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-[rgba(205,239,255,0.1)] text-[var(--editor-accent)]">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function AlignmentGroup({
  value,
  onChange,
}: {
  value: "start" | "center" | "end";
  onChange: (value: "start" | "center" | "end") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange("start")}
        className={cn(
          groupButtonClassName,
          value === "start" ? activeGroupButtonClassName : inactiveGroupButtonClassName,
        )}
        aria-label="Align left"
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("center")}
        className={cn(
          groupButtonClassName,
          value === "center" ? activeGroupButtonClassName : inactiveGroupButtonClassName,
        )}
        aria-label="Align center"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("end")}
        className={cn(
          groupButtonClassName,
          value === "end" ? activeGroupButtonClassName : inactiveGroupButtonClassName,
        )}
        aria-label="Align right"
      >
        <AlignRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmphasisGroup({
  fontWeight,
  italic,
  underline,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
}: {
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggleBold}
        className={cn(
          groupButtonClassName,
          fontWeight >= 700 ? activeGroupButtonClassName : inactiveGroupButtonClassName,
        )}
        aria-label="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleItalic}
        className={cn(
          groupButtonClassName,
          italic ? activeGroupButtonClassName : inactiveGroupButtonClassName,
        )}
        aria-label="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleUnderline}
        className={cn(
          groupButtonClassName,
          underline ? activeGroupButtonClassName : inactiveGroupButtonClassName,
        )}
        aria-label="Underline"
      >
        <Underline className="h-4 w-4" />
      </button>
    </div>
  );
}

function ToolPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium text-white">{title}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyInspector() {
  return null;
}

function Inspector({
  selectedOverlay,
  onOverlayFieldChange,
  onOverlayStyleChange,
  onOverlayStyleLiveChange,
  onOverlayAnimationChange,
  onOverlayTransitionChange,
}: Pick<
  SidebarPanelProps,
  | "selectedOverlay"
  | "onOverlayFieldChange"
  | "onOverlayStyleChange"
  | "onOverlayStyleLiveChange"
  | "onOverlayAnimationChange"
  | "onOverlayTransitionChange"
>) {
  if (!selectedOverlay) {
    return <EmptyInspector />;
  }

  const type = selectedOverlay.content.type ?? "text";
  const style = selectedOverlay.content.style;
  const background = selectedOverlay.content.background;
  const animation = selectedOverlay.content.animation;
  const transition = selectedOverlay.content.transition;
  const layout = selectedOverlay.content.layout;
  const isTextual = type === "text";
  const usesMedia = type === "image" || type === "logo" || type === "icon";
  const backgroundOpacity = background?.enabled ? (background.opacity ?? 0.82) : 0;

  return (
    <div className="space-y-4">
      {isTextual ? (
        <Field label="Text">
          <Textarea
            value={selectedOverlay.content.text ?? ""}
            onChange={(event) => onOverlayFieldChange("text", event.currentTarget.value)}
          />
        </Field>
      ) : null}

      {usesMedia ? (
        <Field label="Source">
          <Input
            value={selectedOverlay.content.mediaUrl ?? ""}
            onChange={(event) => onOverlayFieldChange("mediaUrl", event.currentTarget.value)}
          />
        </Field>
      ) : null}

      <Field label="Link">
        <Input
          value={selectedOverlay.content.linkHref ?? ""}
          onChange={(event) => onOverlayFieldChange("linkHref", event.currentTarget.value)}
        />
      </Field>

      {isTextual ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px] sm:items-end">
          <Field label="Font">
            <Select
              value={style?.fontFamily ?? "Inter"}
              onValueChange={(value) => onOverlayStyleChange("fontFamily", value)}
            >
              <SelectTrigger className="rounded-[12px]" size="default">
                <SelectValue placeholder="Font" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter">Inter</SelectItem>
                <SelectItem value="Manrope">Manrope</SelectItem>
                <SelectItem value="DM Sans">DM Sans</SelectItem>
                <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                <SelectItem value="Instrument Sans">Instrument Sans</SelectItem>
                <SelectItem value="Cormorant Garamond">Cormorant Garamond</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Size">
            <Input
              className={numberInputClassName}
              type="number"
              min="12"
              max="120"
              value={style?.fontSize ?? 34}
              onChange={(event) =>
                onOverlayStyleChange("fontSize", Number(event.currentTarget.value))
              }
            />
          </Field>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[auto_auto] sm:items-end">
        {isTextual ? (
          <Field label="Format">
            <EmphasisGroup
              fontWeight={style?.fontWeight ?? 600}
              italic={style?.italic ?? false}
              underline={style?.underline ?? false}
              onToggleBold={() =>
                onOverlayStyleChange("fontWeight", (style?.fontWeight ?? 600) >= 700 ? 600 : 700)
              }
              onToggleItalic={() => onOverlayStyleChange("italic", !(style?.italic ?? false))}
              onToggleUnderline={() =>
                onOverlayStyleChange("underline", !(style?.underline ?? false))
              }
            />
          </Field>
        ) : null}
        {isTextual ? (
          <Field label="Align">
            <AlignmentGroup
              value={(style?.textAlign as "start" | "center" | "end") ?? "start"}
              onChange={(value) => onOverlayStyleChange("textAlign", value)}
            />
          </Field>
        ) : null}
      </div>

      <div className={cn("grid gap-3", isTextual ? "sm:grid-cols-2" : undefined)}>
        {isTextual ? (
          <Field label="Color">
            <ColorPicker
              label="Color"
              value={style?.color ?? "#f6f7fb"}
              onLiveChange={(value) => onOverlayStyleLiveChange?.("color", value)}
              onCommitChange={(value) => onOverlayStyleChange("color", value)}
            />
          </Field>
        ) : null}
        <Field label="Background">
          <ColorPicker
            label="Background"
            value={background?.color ?? "#0d1016"}
            onLiveChange={(value) => onOverlayStyleLiveChange?.("backgroundColor", value)}
            onCommitChange={(value) => onOverlayStyleChange("backgroundColor", value)}
            opacity={backgroundOpacity}
            onOpacityChange={(value) => onOverlayStyleChange("backgroundOpacity", value)}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <SectionLabel>Animation</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reveal">
            <Select
              value={animation?.preset ?? "fade"}
              onValueChange={(value) => onOverlayAnimationChange("preset", value)}
            >
              <SelectTrigger className="rounded-[12px]" size="default">
                <SelectValue placeholder="Reveal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="slide-up">Slide up</SelectItem>
                <SelectItem value="slide-down">Slide down</SelectItem>
                <SelectItem value="scale-in">Scale in</SelectItem>
                <SelectItem value="blur-in">Blur in</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Transition">
            <Select
              value={transition?.preset ?? "crossfade"}
              onValueChange={(value) => onOverlayTransitionChange("preset", value)}
            >
              <SelectTrigger className="rounded-[12px]" size="default">
                <SelectValue placeholder="Transition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="crossfade">Crossfade</SelectItem>
                <SelectItem value="wipe">Wipe</SelectItem>
                <SelectItem value="zoom-dissolve">Zoom dissolve</SelectItem>
                <SelectItem value="blur-dissolve">Blur dissolve</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Duration (sec)">
            <Input
              className={numberInputClassName}
              type="number"
              step="0.01"
              min="0.08"
              max="2.5"
              value={animation?.duration ?? 0.45}
              onChange={(event) =>
                onOverlayAnimationChange("duration", Number(event.currentTarget.value))
              }
            />
          </Field>
          <Field label="Delay (sec)">
            <Input
              className={numberInputClassName}
              type="number"
              step="0.01"
              min="0"
              max="1.5"
              value={animation?.delay ?? 0}
              onChange={(event) =>
                onOverlayAnimationChange("delay", Number(event.currentTarget.value))
              }
            />
          </Field>
        </div>

        <details className="pt-1" open>
          <summary className="cursor-pointer list-none text-sm text-[var(--foreground-muted)]">
            Range
          </summary>
          <div className="mt-3 space-y-3">
            <Slider
              min={0}
              max={100}
              step={1}
              value={[
                Math.round(selectedOverlay.timing.start * 100),
                Math.round(selectedOverlay.timing.end * 100),
              ]}
              minStepsBetweenThumbs={4}
              onValueChange={([start = 0, end = 100]) => {
                onOverlayFieldChange("start", start / 100);
                onOverlayFieldChange("end", end / 100);
              }}
            />
            <div className="flex items-center justify-between text-xs text-[var(--foreground-muted)]">
              <span>{formatPercent(selectedOverlay.timing.start)}</span>
              <span>{formatPercent(selectedOverlay.timing.end)}</span>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export function SidebarPanel({
  projectId,
  activeContext,
  selectedOverlay,
  onContextChange,
  onOverlayFieldChange,
  onOverlayStyleChange,
  onOverlayStyleLiveChange,
  onOverlayAnimationChange,
  onOverlayTransitionChange,
  onAddContent,
}: SidebarPanelProps) {
  const showUploadTool = activeContext === "upload";
  const showAiTool = activeContext === "ai";

  return (
    <aside
      className="flex h-full w-[360px] shrink-0 flex-col border-r"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton
              icon={<Type className="h-4 w-4" />}
              label="Add Text"
              onClick={() => onAddContent("text")}
            />
            <ActionButton
              icon={<ImagePlus className="h-4 w-4" />}
              label="Add Image"
              onClick={() => onAddContent("image")}
            />
            <ActionButton
              icon={<Film className="h-4 w-4" />}
              label="Import Video"
              active={showUploadTool}
              onClick={() => onContextChange(showUploadTool ? "insert" : "upload")}
            />
            <ActionButton
              icon={<Sparkles className="h-4 w-4" />}
              label="AI Import"
              active={showAiTool}
              onClick={() => onContextChange(showAiTool ? "insert" : "ai")}
            />
          </div>

          {showUploadTool ? (
            <ToolPanel title="Import Video">
              <UploadPanel projectId={projectId} embedded />
            </ToolPanel>
          ) : null}

          {showAiTool ? (
            <ToolPanel title="AI Import">
              <ProviderPanel projectId={projectId} embedded />
            </ToolPanel>
          ) : null}

          <Inspector
            selectedOverlay={selectedOverlay}
            onOverlayFieldChange={onOverlayFieldChange}
            onOverlayStyleChange={onOverlayStyleChange}
            onOverlayStyleLiveChange={onOverlayStyleLiveChange}
            onOverlayAnimationChange={onOverlayAnimationChange}
            onOverlayTransitionChange={onOverlayTransitionChange}
          />
        </div>
      </div>
    </aside>
  );
}
