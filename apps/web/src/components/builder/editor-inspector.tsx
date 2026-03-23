"use client";

import { Layers3 } from "lucide-react";
import { ColorPicker } from "../ui/color-picker";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../ui/select";
import { Slider } from "../ui/slider";
import { Textarea } from "../ui/textarea";
import type { SidebarPanelProps } from "./editor-sidebar";
import {
  AlignmentGroup, EmphasisGroup, EmptyInspector,
  Field, formatPercent, numberInputClassName,
  SectionLabel, ToolPanel,
} from "./editor-inspector-primitives";

export function Inspector({
  selectedOverlay,
  onOverlayFieldChange,
  onOverlayStyleChange,
  onOverlayStyleLiveChange,
  onOverlayAnimationChange,
  onOverlayTransitionChange,
  selectedGroupChildren,
  canUngroupSelection,
  onUngroupSelection,
  onSelectGroupChild,
}: Pick<
  SidebarPanelProps,
  | "selectedOverlay"
  | "onOverlayFieldChange"
  | "onOverlayStyleChange"
  | "onOverlayStyleLiveChange"
  | "onOverlayAnimationChange"
  | "onOverlayTransitionChange"
  | "selectedGroupChildren"
  | "canUngroupSelection"
  | "onUngroupSelection"
  | "onSelectGroupChild"
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
  const isGroup = type === "group";
  const backgroundOpacity = background?.enabled ? (background.opacity ?? 0.82) : 0;

  if (isGroup) {
    return (
      <div className="space-y-4">
        {canUngroupSelection ? (
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-[rgba(205,239,255,0.08)] text-[var(--editor-accent)]">
                <Layers3 className="h-3.5 w-3.5" />
              </span>
              <span>{selectedGroupChildren?.length ?? 0} items</span>
            </div>
            <button
              type="button"
              onClick={onUngroupSelection}
              className="focus-ring inline-flex h-8 items-center rounded-[10px] border px-2.5 text-xs font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              Ungroup
            </button>
          </div>
        ) : null}

        <div className="text-xs text-[var(--foreground-muted)]">
          Grouped items are locked. Move, duplicate, delete, or ungroup to edit them.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isTextual ? (
        <Field label="Text">
          <Textarea
            aria-label="Overlay text"
            value={selectedOverlay.content.text ?? ""}
            onChange={(event) => onOverlayFieldChange("text", event.currentTarget.value)}
          />
        </Field>
      ) : null}

      {usesMedia ? (
        <Field label="Source">
          <Input
            aria-label="Overlay source"
            value={selectedOverlay.content.mediaUrl ?? ""}
            onChange={(event) => onOverlayFieldChange("mediaUrl", event.currentTarget.value)}
          />
        </Field>
      ) : null}

      {!isGroup ? (
        <Field label="Link">
        <Input
          aria-label="Overlay link"
          value={selectedOverlay.content.linkHref ?? ""}
          onChange={(event) => onOverlayFieldChange("linkHref", event.currentTarget.value)}
        />
        </Field>
      ) : null}

      {isTextual ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px] sm:items-end">
          <Field label="Font">
            <Select
              value={style?.fontFamily ?? "Inter"}
              onValueChange={(value) => onOverlayStyleChange("fontFamily", value)}
            >
              <SelectTrigger aria-label="Overlay font" className="rounded-[12px]" size="default">
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
              aria-label="Overlay font size"
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
        <SectionLabel>Animation</SectionLabel>        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reveal">
            <Select
              value={animation?.preset ?? "fade"}
              onValueChange={(value) => onOverlayAnimationChange("preset", value)}
            >
              <SelectTrigger aria-label="Overlay reveal animation" className="rounded-[12px]" size="default">
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
              <SelectTrigger aria-label="Overlay transition" className="rounded-[12px]" size="default">
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
              aria-label="Overlay animation duration"
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
              aria-label="Overlay animation delay"
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
