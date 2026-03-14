"use client";

import React, { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Flag,
  GripVertical,
  ImagePlus,
  Layers3,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Text,
  Type,
  Video,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EditableOverlay = {
  id: string;
  timing: { start: number; end: number };
  content: {
    type?: "text" | "image" | "logo" | "icon";
    eyebrow?: string;
    headline?: string;
    body?: string;
    mediaUrl?: string;
    linkHref?: string;
    cta?: { label: string; href: string };
    align?: "start" | "center" | "end";
    theme?: "light" | "dark" | "accent";
    layout?: { x: number; y: number; width: number; height?: number };
    style?: {
      fontFamily?: string;
      fontWeight?: number;
      fontSize?: number;
      lineHeight?: number;
      letterSpacing?: number;
      textAlign?: string;
      color?: string;
      opacity?: number;
      maxWidth?: number;
      italic?: boolean;
      textTransform?: string;
      buttonLike?: boolean;
    };
    background?: {
      enabled?: boolean;
      mode?: "transparent" | "solid";
      color?: string;
      opacity?: number;
      radius?: number;
      paddingX?: number;
      paddingY?: number;
      borderColor?: string;
      borderOpacity?: number;
    };
    animation?: {
      preset?: string;
      easing?: string;
      duration?: number;
      delay?: number;
    };
    transition?: {
      preset?: string;
      easing?: string;
      duration?: number;
    };
    layer?: number;
  };
};

const contentButtons = [
  { id: "video",       label: "Video",       icon: Video },
  { id: "headline",    label: "Headline",    icon: Type },
  { id: "subheadline", label: "Subheadline", icon: Type },
  { id: "text",        label: "Text",        icon: Text },
  { id: "image",       label: "Image",       icon: ImagePlus },
  { id: "logo",        label: "Logo",        icon: Layers3 },
  { id: "icon",        label: "Icon",        icon: Sparkles },
  { id: "moment",      label: "Moment",      icon: Flag },
] as const;

const animationPresets = ["none", "fade", "slide-up", "slide-down", "scale-in", "blur-in"] as const;
const easingPresets = ["linear", "ease-out", "ease-in-out", "back-out", "expo-out"] as const;
const transitionPresets = ["fade", "crossfade", "wipe", "zoom-dissolve", "blur-dissolve"] as const;
const fontFamilies = ["Inter", "Manrope", "DM Sans", "Space Grotesk", "Instrument Sans", "Cormorant Garamond"] as const;
const fontWeights = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
];

interface SidebarPanelProps {
  overlays: EditableOverlay[];
  selectedOverlay?: EditableOverlay;
  selectedClip?: { id: string; trackType: string; metadata?: { overlayId?: string } };
  selection?: { clipId: string; trackType: string } | null;
  projectTitle: string;
  sectionTitle: string;
  frameRangeStart: number;
  frameRangeEnd: number;
  scrubStrength: number;
  sectionHeightVh: number;
  onProjectTitleChange: (value: string) => void;
  onSectionTitleChange: (value: string) => void;
  onFrameRangeChange: (field: "start" | "end", value: number) => void;
  onSectionFieldChange: (field: string, value: number) => void;
  onOverlayFieldChange: (field: string, value: string) => void;
  onOverlayStyleChange: (field: string, value: string | number | boolean) => void;
  onOverlayAnimationChange: (field: string, value: string | number) => void;
  onOverlayTransitionChange: (field: string, value: string | number) => void;
  onSelectOverlay: (id: string) => void;
  onReorderOverlays: (fromIndex: number, toIndex: number) => void;
  onAddContent: (type: string) => void;
  extraAddContent?: ReactNode;
}

// ── Small collapsible section with proper open/closed state ──────────────
function SidebarSection({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className="rounded-2xl border"
      style={{ borderColor: "var(--editor-border)", background: "rgba(255,255,255,0.025)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--editor-text-dim)" }}>
            {title}
          </div>
          {description && !open ? (
            <p className="mt-0.5 truncate text-[11px] leading-5" style={{ color: "var(--editor-text-dim)" }}>{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className="h-4 w-4 flex-shrink-0 transition-transform"
          style={{ color: "var(--editor-text-dim)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--editor-border)" }}>
          {description ? (
            <p className="text-[11px] leading-5" style={{ color: "var(--editor-text-dim)" }}>{description}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

function InspectorGroup({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--editor-border)", background: "rgba(12,16,22,0.55)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-white"
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--editor-accent)]" />
          {title}
        </span>
        <ChevronDown
          className="h-4 w-4 text-[var(--editor-text-dim)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: "var(--editor-border)" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function InlineGroup({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

function AddButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[68px] flex-col items-start gap-2 rounded-xl border px-3.5 py-3 text-left transition-[background,border-color,transform] duration-150 hover:-translate-y-[1px] hover:bg-[var(--editor-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] cursor-pointer"
      style={{ background: "var(--editor-shell)", borderColor: "var(--editor-border)", color: "var(--editor-text)" }}
    >
      <Icon className="h-4 w-4 text-[var(--editor-accent)]" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function FieldRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-medium" style={{ color: "var(--editor-text)" }}>{label}</Label>
        {hint ? <span className="text-[10px]" style={{ color: "var(--editor-text-dim)" }}>{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function StyledInput({ value, onChange, type = "text", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      type={type}
      value={value}
      onChange={onChange}
      className="h-9 rounded-lg border text-xs"
      style={{ background: "var(--editor-shell)", borderColor: "var(--editor-border)", color: "var(--editor-text)" }}
      {...rest}
    />
  );
}

function StyledSelect({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        className="h-9 rounded-lg border text-xs"
        style={{ background: "var(--editor-shell)", borderColor: "var(--editor-border)", color: "var(--editor-text)" }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function AlignButtons({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const buttons = [
    { value: "start", icon: AlignLeft },
    { value: "center", icon: AlignCenter },
    { value: "end", icon: AlignRight },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {buttons.map(({ value: buttonValue, icon: Icon }) => {
        const active = value === buttonValue;
        return (
          <button
            key={buttonValue}
            type="button"
            onClick={() => onChange(buttonValue)}
            className="flex h-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--editor-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)] cursor-pointer"
            style={{
              borderColor: active ? "var(--editor-accent)" : "var(--editor-border)",
              background: active ? "rgba(103,232,249,0.1)" : "var(--editor-shell)",
              color: active ? "var(--editor-accent)" : "var(--editor-text-dim)",
            }}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

// Media preview card for image/logo/icon overlays
function MediaPreviewCard({ url, type }: { url?: string; type: string }) {
  if (!url) {
    return (
      <div
        className="flex h-24 items-center justify-center rounded-xl border text-xs"
        style={{ borderColor: "var(--editor-border)", background: "var(--editor-shell)", color: "var(--editor-text-dim)" }}
      >
        No media — paste a URL below
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--editor-border)", background: "var(--editor-shell)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={type}
        className="max-h-32 w-full object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px]"
        style={{ background: "rgba(0,0,0,0.6)", color: "var(--editor-text-dim)" }}
      >
        {type}
      </div>
    </div>
  );
}


// ── Drag-to-reorder layer list ────────────────────────────────────────────
function DraggableLayerList({
  overlays,
  selectedId,
  onSelect,
  onReorder,
}: {
  overlays: EditableOverlay[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (overlays.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: "var(--editor-text-dim)" }}>
        No overlays yet. Add content above.
      </p>
    );
  }

  return (
    <div className="max-h-52 space-y-0.5 overflow-y-auto pr-1 sidebar-scroll">
      {overlays.map((overlay, index) => {
        const selected = overlay.id === selectedId;
        const isDragOver = dragOverIndex === index;
        return (
          <div
            key={overlay.id}
            draggable
            onDragStart={(e) => {
              dragIndexRef.current = index;
              e.dataTransfer.effectAllowed = "move";
              // Firefox requires setData to allow drag
              e.dataTransfer.setData("text/plain", overlay.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverIndex(index);
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragIndexRef.current;
              if (from !== null && from !== index) {
                onReorder(from, index);
              }
              dragIndexRef.current = null;
              setDragOverIndex(null);
            }}
            onDragEnd={() => {
              dragIndexRef.current = null;
              setDragOverIndex(null);
            }}
            className="group flex items-center gap-1 rounded-xl border transition-colors cursor-default"
            style={{
              borderColor: isDragOver
                ? "var(--editor-accent)"
                : selected
                  ? "var(--editor-accent)"
                  : "transparent",
              background: isDragOver
                ? "rgba(103,232,249,0.05)"
                : selected
                  ? "rgba(103,232,249,0.08)"
                  : "transparent",
              outline: isDragOver ? "1px solid rgba(103,232,249,0.25)" : undefined,
            }}
          >
            {/* Drag handle */}
            <div
              className="flex h-full cursor-grab items-center px-2 py-3 active:cursor-grabbing"
              style={{ color: "var(--editor-text-dim)" }}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            {/* Layer info button */}
            <button
              type="button"
              onClick={() => onSelect(overlay.id)}
              className="min-w-0 flex-1 py-2.5 pr-3 text-left focus:outline-none"
            >
              <div className="truncate text-xs font-medium text-white">
                {overlay.content.headline || overlay.content.body || "Untitled"}
              </div>
              <div className="pt-0.5 text-[10px] tabular-nums" style={{ color: "var(--editor-text-dim)" }}>
                {overlay.content.type ?? "text"} · {Math.round(overlay.timing.start * 100)}–{Math.round(overlay.timing.end * 100)}%
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function SidebarPanel({
  overlays,
  selectedOverlay,
  selectedClip,
  selection,
  projectTitle,
  sectionTitle,
  frameRangeStart,
  frameRangeEnd,
  scrubStrength,
  sectionHeightVh,
  onProjectTitleChange,
  onSectionTitleChange,
  onFrameRangeChange,
  onSectionFieldChange,
  onOverlayFieldChange,
  onOverlayStyleChange,
  onOverlayAnimationChange,
  onOverlayTransitionChange,
  onSelectOverlay,
  onReorderOverlays,
  onAddContent,
  extraAddContent,
}: SidebarPanelProps) {
  const style = selectedOverlay?.content.style;
  const layout = selectedOverlay?.content.layout;
  const animation = selectedOverlay?.content.animation;
  const transition = selectedOverlay?.content.transition;
  const background = selectedOverlay?.content.background;
  const isTextLike = !selectedOverlay || selectedOverlay.content.type === "text";
  const selectedLabel = selectedOverlay?.content.headline || selectedOverlay?.content.body || "Selected item";
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return (
    <aside
      className="flex flex-col overflow-y-auto border-r px-4 py-5 sidebar-scroll"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)", width: 320, minWidth: 320 }}
    >
      <div className="space-y-4 pb-4">

        {/* Add content — always open, no toggle */}
        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--editor-border)", background: "rgba(255,255,255,0.025)" }}
        >
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--editor-text-dim)" }}>
            Add content
          </div>
          <div className="grid grid-cols-2 gap-2">
            {contentButtons.map(({ id, label, icon }) => (
              <AddButton key={id} icon={icon} label={label} onClick={() => onAddContent(id)} />
            ))}
          </div>
          {extraAddContent ? <div className="mt-3 pt-1">{extraAddContent}</div> : null}
        </div>

        {/* Selected overlay editor */}
        {selectedOverlay ? (
          <SidebarSection
            title="Edit selected"
            description={`${selectedLabel} · ${selectedOverlay.content.type ?? "text"}`}
            defaultOpen={true}
          >
            <div className="space-y-3">
              <InspectorGroup title="Content" icon={Type}>
                {selectedOverlay.content.eyebrow !== undefined || isTextLike ? (
                  <FieldRow label="Eyebrow">
                    <StyledInput
                      value={selectedOverlay.content.eyebrow ?? ""}
                      onChange={(e) => onOverlayFieldChange("eyebrow", e.target.value)}
                      placeholder="Optional label"
                    />
                  </FieldRow>
                ) : null}
                <FieldRow label="Headline">
                  <StyledInput
                    value={selectedOverlay.content.headline ?? ""}
                    onChange={(e) => onOverlayFieldChange("headline", e.target.value)}
                  />
                </FieldRow>
                {isTextLike ? (
                  <FieldRow label="Body">
                    <StyledInput
                      value={selectedOverlay.content.body ?? ""}
                      onChange={(e) => onOverlayFieldChange("body", e.target.value)}
                    />
                  </FieldRow>
                ) : null}
                <FieldRow label="Link URL" hint="Optional">
                  <StyledInput
                    value={selectedOverlay.content.linkHref ?? ""}
                    onChange={(e) => onOverlayFieldChange("linkHref", e.target.value)}
                    placeholder="https://"
                  />
                </FieldRow>
                {!isTextLike ? (
                  <>
                    <MediaPreviewCard url={selectedOverlay.content.mediaUrl} type={selectedOverlay.content.type ?? "media"} />
                    <FieldRow label="Media URL" hint="CDN asset">
                      <StyledInput
                        value={selectedOverlay.content.mediaUrl ?? ""}
                        onChange={(e) => onOverlayFieldChange("mediaUrl", e.target.value)}
                        placeholder="https://cdn.example.com/asset.webp"
                      />
                    </FieldRow>
                  </>
                ) : null}
              </InspectorGroup>

              <InspectorGroup title={isTextLike ? "Typography" : "Appearance"} icon={Palette}>
                {isTextLike ? (
                  <>
                    <FieldRow label="Font family">
                      <StyledSelect value={style?.fontFamily ?? "Inter"} onValueChange={(v) => onOverlayStyleChange("fontFamily", v)}>
                        {fontFamilies.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </StyledSelect>
                    </FieldRow>
                    <InlineGroup>
                      <FieldRow label="Weight">
                        <StyledSelect value={String(style?.fontWeight ?? 600)} onValueChange={(v) => onOverlayStyleChange("fontWeight", Number(v))}>
                          {fontWeights.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                        </StyledSelect>
                      </FieldRow>
                      <FieldRow label="Size">
                        <StyledInput type="number" value={style?.fontSize ?? 32} onChange={(e) => onOverlayStyleChange("fontSize", Number(e.target.value))} />
                      </FieldRow>
                    </InlineGroup>
                    <FieldRow label="Text align">
                      <AlignButtons value={style?.textAlign ?? "start"} onChange={(v) => onOverlayStyleChange("textAlign", v)} />
                    </FieldRow>
                  </>
                ) : null}
                <InlineGroup>
                  <FieldRow label="Color">
                    <div className="flex items-center gap-2">
                      {hasHydrated ? (
                        <input
                          type="color"
                          value={style?.color ?? "#f6f7fb"}
                          onChange={(e) => onOverlayStyleChange("color", e.target.value)}
                          className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border"
                          style={{ borderColor: "var(--editor-border)", background: "var(--editor-shell)" }}
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="h-9 w-9 flex-shrink-0 rounded-lg border"
                          style={{
                            borderColor: "var(--editor-border)",
                            background: style?.color ?? "#f6f7fb",
                          }}
                        />
                      )}
                      <StyledInput
                        value={style?.color ?? "#f6f7fb"}
                        onChange={(e) => onOverlayStyleChange("color", e.target.value)}
                      />
                    </div>
                  </FieldRow>
                  <FieldRow label="Opacity">
                    <StyledInput type="number" value={style?.opacity ?? 1} min={0} max={1} step={0.05} onChange={(e) => onOverlayStyleChange("opacity", Number(e.target.value))} />
                  </FieldRow>
                </InlineGroup>
                <InlineGroup>
                  <FieldRow label="Width">
                    <StyledInput type="number" value={layout?.width ?? style?.maxWidth ?? 420} onChange={(e) => onOverlayStyleChange("width", Number(e.target.value))} />
                  </FieldRow>
                  <FieldRow label="Height">
                    <StyledInput type="number" value={layout?.height ?? ""} onChange={(e) => onOverlayStyleChange("height", Number(e.target.value))} placeholder="Auto" />
                  </FieldRow>
                </InlineGroup>
                <InlineGroup>
                  <FieldRow label="X (0–1)">
                    <StyledInput type="number" value={layout?.x ?? 0.08} step={0.01} min={0} max={1} onChange={(e) => onOverlayStyleChange("x", Number(e.target.value))} />
                  </FieldRow>
                  <FieldRow label="Y (0–1)">
                    <StyledInput type="number" value={layout?.y ?? 0.12} step={0.01} min={0} max={1} onChange={(e) => onOverlayStyleChange("y", Number(e.target.value))} />
                  </FieldRow>
                </InlineGroup>
                <InlineGroup>
                  <FieldRow label="Theme">
                    <StyledSelect value={selectedOverlay.content.theme ?? "dark"} onValueChange={(v) => onOverlayFieldChange("theme", v)}>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="accent">Accent</SelectItem>
                    </StyledSelect>
                  </FieldRow>
                  <FieldRow label="Layer">
                    <StyledInput type="number" value={selectedOverlay.content.layer ?? 0} onChange={(e) => onOverlayStyleChange("layer", Number(e.target.value))} />
                  </FieldRow>
                </InlineGroup>
              </InspectorGroup>

              <InspectorGroup title="Background" icon={Layers3} defaultOpen={false}>
                <InlineGroup>
                  <FieldRow label="Enabled">
                    <StyledSelect value={background?.enabled ? "on" : "off"} onValueChange={(v) => onOverlayStyleChange("backgroundEnabled", v === "on")}>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="on">On</SelectItem>
                    </StyledSelect>
                  </FieldRow>
                  <FieldRow label="Mode">
                    <StyledSelect value={background?.mode ?? "transparent"} onValueChange={(v) => onOverlayStyleChange("backgroundMode", v)}>
                      <SelectItem value="transparent">Transparent</SelectItem>
                      <SelectItem value="solid">Solid</SelectItem>
                    </StyledSelect>
                  </FieldRow>
                </InlineGroup>
                <InlineGroup>
                  <FieldRow label="Fill">
                    <StyledInput value={background?.color ?? "#0d1016"} onChange={(e) => onOverlayStyleChange("backgroundColor", e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Fill opacity">
                    <StyledInput type="number" value={background?.opacity ?? 0.82} step={0.05} min={0} max={1} onChange={(e) => onOverlayStyleChange("backgroundOpacity", Number(e.target.value))} />
                  </FieldRow>
                </InlineGroup>
                <InlineGroup>
                  <FieldRow label="Radius">
                    <StyledInput type="number" value={background?.radius ?? 14} onChange={(e) => onOverlayStyleChange("backgroundRadius", Number(e.target.value))} />
                  </FieldRow>
                  <FieldRow label="Border opacity">
                    <StyledInput type="number" value={background?.borderOpacity ?? 0} step={0.05} min={0} max={1} onChange={(e) => onOverlayStyleChange("backgroundBorderOpacity", Number(e.target.value))} />
                  </FieldRow>
                </InlineGroup>
              </InspectorGroup>

              <InspectorGroup title="Motion &amp; timing" icon={SlidersHorizontal}>
                <InlineGroup>
                  <FieldRow label="Start" hint={`${Math.round(selectedOverlay.timing.start * 100)}%`}>
                    <Slider value={[selectedOverlay.timing.start]} min={0} max={1} step={0.01} onValueChange={([v]) => onOverlayFieldChange("start", String(v))} />
                  </FieldRow>
                  <FieldRow label="End" hint={`${Math.round(selectedOverlay.timing.end * 100)}%`}>
                    <Slider value={[selectedOverlay.timing.end]} min={0} max={1} step={0.01} onValueChange={([v]) => onOverlayFieldChange("end", String(v))} />
                  </FieldRow>
                </InlineGroup>
                <FieldRow label="Animation">
                  <StyledSelect value={animation?.preset ?? "none"} onValueChange={(v) => onOverlayAnimationChange("preset", v)}>
                    {animationPresets.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </StyledSelect>
                </FieldRow>
                <InlineGroup>
                  <FieldRow label="Easing">
                    <StyledSelect value={animation?.easing ?? "ease-out"} onValueChange={(v) => onOverlayAnimationChange("easing", v)}>
                      {easingPresets.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </StyledSelect>
                  </FieldRow>
                  <FieldRow label="Duration">
                    <StyledInput type="number" value={animation?.duration ?? 0.35} step={0.05} min={0.05} onChange={(e) => onOverlayAnimationChange("duration", Number(e.target.value))} />
                  </FieldRow>
                </InlineGroup>
                <InlineGroup>
                  <FieldRow label="Delay">
                    <StyledInput type="number" value={animation?.delay ?? 0} step={0.05} min={0} onChange={(e) => onOverlayAnimationChange("delay", Number(e.target.value))} />
                  </FieldRow>
                  <FieldRow label="Transition">
                    <StyledSelect value={transition?.preset ?? "fade"} onValueChange={(v) => onOverlayTransitionChange("preset", v)}>
                      {transitionPresets.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </StyledSelect>
                  </FieldRow>
                </InlineGroup>
              </InspectorGroup>
            </div>
          </SidebarSection>
        ) : null}

        {/* Scene layers list — drag to reorder */}
        <SidebarSection title="Scene layers" description="Drag to reorder" defaultOpen={false}>
          <DraggableLayerList
            overlays={overlays}
            selectedId={selectedOverlay?.id}
            onSelect={onSelectOverlay}
            onReorder={onReorderOverlays}
          />
        </SidebarSection>

        {/* Project/section settings */}
        <SidebarSection title="Project details" description="Sequence range and scroll settings" defaultOpen={false}>
          <div className="space-y-3.5">
            <FieldRow label="Project title">
              <StyledInput value={projectTitle} onChange={(e) => onProjectTitleChange(e.target.value)} />
            </FieldRow>
            <FieldRow label="Section title">
              <StyledInput value={sectionTitle} onChange={(e) => onSectionTitleChange(e.target.value)} />
            </FieldRow>
            <InlineGroup>
              <FieldRow label="Frame start">
                <StyledInput type="number" value={frameRangeStart} onChange={(e) => onFrameRangeChange("start", Number(e.target.value))} />
              </FieldRow>
              <FieldRow label="Frame end">
                <StyledInput type="number" value={frameRangeEnd} onChange={(e) => onFrameRangeChange("end", Number(e.target.value))} />
              </FieldRow>
            </InlineGroup>
            <FieldRow label="Scroll strength" hint={`${scrubStrength.toFixed(2)}×`}>
              <Slider value={[scrubStrength]} min={0.2} max={2} step={0.05} onValueChange={([v]) => onSectionFieldChange("scrubStrength", v)} />
            </FieldRow>
            <FieldRow label="Section height" hint={`${Math.round(sectionHeightVh)}vh`}>
              <Slider value={[sectionHeightVh]} min={120} max={500} step={10} onValueChange={([v]) => onSectionFieldChange("sectionHeightVh", v)} />
            </FieldRow>
          </div>
        </SidebarSection>

      </div>
    </aside>
  );
}
