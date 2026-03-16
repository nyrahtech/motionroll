"use client";

import React, { type ReactNode, useEffect, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ExternalLink,
  ImagePlus,
  Link,
  Palette,
  SlidersHorizontal,
  Text,
  Type,
  Layers3,
  Video,
  Underline,
  Bold,
  Italic,
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
      eyebrowFontSize?: number;
      bodyFontSize?: number;
      lineHeight?: number;
      letterSpacing?: number;
      textAlign?: string;
      color?: string;
      opacity?: number;
      maxWidth?: number;
      italic?: boolean;
      underline?: boolean;
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
  };
};

const contentButtons = [
  { id: "text", label: "Text overlay", icon: Text },
  { id: "image", label: "Image overlay", icon: ImagePlus },
  { id: "video", label: "Upload scene", icon: Video },
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
  { value: "800", label: "Extrabold" },
];

interface SidebarPanelProps {
  overlays: EditableOverlay[];
  selectedOverlay?: EditableOverlay;
  selectedClip?: { id: string; trackType: string; metadata?: { overlayId?: string } };
  selection?: { clipId: string; trackType: string } | null;
  onOverlayFieldChange: (field: string, value: string) => void;
  onOverlayStyleChange: (field: string, value: string | number | boolean) => void;
  onOverlayAnimationChange: (field: string, value: string | number) => void;
  onOverlayTransitionChange: (field: string, value: string | number) => void;
  onSelectOverlay: (id: string) => void;
  onAddContent: (type: string) => void;
  extraAddContent?: ReactNode;
}

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
    <section className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--editor-text-dim)" }}>
            {title}
          </div>
          {description && !open ? (
            <p className="mt-0.5 truncate text-[11px] leading-5" style={{ color: "var(--editor-text-dim)" }}>
              {description}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className="h-4 w-4 flex-shrink-0 transition-transform"
          style={{ color: "var(--editor-text-dim)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open ? (
        <div className="space-y-3 pb-1 pt-3">
          {description ? (
            <p className="text-[11px] leading-5" style={{ color: "var(--editor-text-dim)" }}>
              {description}
            </p>
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
    <div className="border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className="flex w-full items-center justify-between gap-3 py-1.5 text-sm font-medium text-white"
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--editor-accent)]" />
          {title}
        </span>
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{ color: "var(--editor-text-dim)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open ? <div className="space-y-3 pb-2 pt-2">{children}</div> : null}
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
      className="flex min-h-[52px] flex-col items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-center transition-[background,color] duration-150 hover:bg-[var(--editor-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
      style={{ background: "rgba(255,255,255,0.02)", color: "var(--editor-text)" }}
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
      {buttons.map(({ value: bv, icon: Icon }) => {
        const active = value === bv;
        return (
          <button
            key={bv}
            type="button"
            onClick={() => onChange(bv)}
            className="flex h-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--editor-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
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

function StyleToggle({ active, icon: Icon, title, onClick }: { active: boolean; icon: React.ElementType; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--editor-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
      style={{
        borderColor: active ? "var(--editor-accent)" : "var(--editor-border)",
        background: active ? "rgba(103,232,249,0.1)" : "var(--editor-shell)",
        color: active ? "var(--editor-accent)" : "var(--editor-text-dim)",
      }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

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
    <div className="relative overflow-hidden rounded-xl border" style={{ borderColor: "var(--editor-border)", background: "var(--editor-shell)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={type}
        className="max-h-32 w-full object-contain"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px]" style={{ background: "rgba(0,0,0,0.6)", color: "var(--editor-text-dim)" }}>
        {type}
      </div>
    </div>
  );
}

function LinkHintBadge({ href }: { href: string }) {
  if (!href) return null;
  const isAbsolute = /^https?:\/\//i.test(href);
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-medium"
      style={{ color: isAbsolute ? "var(--editor-accent)" : "var(--editor-text-dim)" }}
    >
      {isAbsolute ? <ExternalLink className="h-3 w-3" /> : <Link className="h-3 w-3" />}
      {isAbsolute ? "External link" : "Relative path"}
    </span>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return (
    <FieldRow label={label}>
      <div className="flex items-center gap-2">
        {hydrated ? (
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border"
            style={{ borderColor: "var(--editor-border)", background: "var(--editor-shell)", padding: "2px" }}
          />
        ) : (
          <div className="h-9 w-9 flex-shrink-0 rounded-lg border" style={{ borderColor: "var(--editor-border)", background: value }} />
        )}
        <StyledInput value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </FieldRow>
  );
}

export function SidebarPanel({
  overlays,
  selectedOverlay,
  onOverlayFieldChange,
  onOverlayStyleChange,
  onOverlayAnimationChange,
  onOverlayTransitionChange,
  onAddContent,
  extraAddContent,
}: SidebarPanelProps) {
  const style = selectedOverlay?.content.style;
  const layout = selectedOverlay?.content.layout;
  const animation = selectedOverlay?.content.animation;
  const transition = selectedOverlay?.content.transition;
  const background = selectedOverlay?.content.background;
  const isTextLike = !selectedOverlay || selectedOverlay.content.type === "text";
  const selectedLabel = selectedOverlay?.content.headline || selectedOverlay?.content.body || "Selected overlay";

  return (
    <aside
      className="flex flex-col overflow-y-auto border-r px-4 py-4 sidebar-scroll"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)", width: 300, minWidth: 300 }}
    >
      <div className="space-y-4 pb-4">
        {/* Add overlay buttons */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {contentButtons.map(({ id, label, icon }) => (
              <AddButton key={id} icon={icon} label={label} onClick={() => onAddContent(id)} />
            ))}
          </div>
          {extraAddContent ? <div className="pt-1">{extraAddContent}</div> : null}
        </div>

        {selectedOverlay ? (
          <SidebarSection
            title="Overlay settings"
            description={`${selectedLabel} · ${selectedOverlay.content.type ?? "text"}`}
            defaultOpen
          >
            <div className="space-y-3">

              {/* ── Content ─────────────────────────────────────────── */}
              <InspectorGroup title="Content" icon={Type}>
                {isTextLike && selectedOverlay.content.eyebrow !== undefined ? (
                  <FieldRow label="Eyebrow">
                    <StyledInput
                      value={selectedOverlay.content.eyebrow ?? ""}
                      onChange={(e) => onOverlayFieldChange("eyebrow", e.target.value)}
                      placeholder="Optional label"
                    />
                  </FieldRow>
                ) : null}
                <FieldRow label={isTextLike ? "Headline" : "Caption"}>
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

                {/* Link with absolute/relative hint */}
                <FieldRow label="Link">
                  <StyledInput
                    value={selectedOverlay.content.linkHref ?? ""}
                    onChange={(e) => onOverlayFieldChange("linkHref", e.target.value)}
                    placeholder="https:// or /path"
                  />
                  <div className="mt-1">
                    <LinkHintBadge href={selectedOverlay.content.linkHref ?? ""} />
                  </div>
                </FieldRow>

                {!isTextLike ? (
                  <>
                    <MediaPreviewCard url={selectedOverlay.content.mediaUrl} type={selectedOverlay.content.type ?? "media"} />
                    <FieldRow label="Media URL">
                      <StyledInput
                        value={selectedOverlay.content.mediaUrl ?? ""}
                        onChange={(e) => onOverlayFieldChange("mediaUrl", e.target.value)}
                        placeholder="https://cdn.example.com/asset.webp"
                      />
                    </FieldRow>
                  </>
                ) : null}
              </InspectorGroup>

              {/* ── Typography ──────────────────────────────────────── */}
              {isTextLike ? (
                <InspectorGroup title="Typography" icon={Palette}>
                  <FieldRow label="Font">
                    <StyledSelect value={style?.fontFamily ?? "Inter"} onValueChange={(v) => onOverlayStyleChange("fontFamily", v)}>
                      {fontFamilies.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </StyledSelect>
                  </FieldRow>

                  {/* Text style toggles */}
                  <FieldRow label="Style">
                    <div className="flex gap-2">
                      <StyledSelect value={String(style?.fontWeight ?? 600)} onValueChange={(v) => onOverlayStyleChange("fontWeight", Number(v))}>
                        {fontWeights.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                      </StyledSelect>
                      <StyleToggle active={style?.italic ?? false} icon={Italic} title="Italic" onClick={() => onOverlayStyleChange("italic", !(style?.italic ?? false))} />
                      <StyleToggle active={style?.underline ?? false} icon={Underline} title="Underline" onClick={() => onOverlayStyleChange("underline", !(style?.underline ?? false))} />
                      <StyleToggle active={(style?.fontWeight ?? 600) >= 700} icon={Bold} title="Bold" onClick={() => onOverlayStyleChange("fontWeight", (style?.fontWeight ?? 600) >= 700 ? 600 : 700)} />
                    </div>
                  </FieldRow>

                  {/* Per-field font sizes */}
                  <FieldRow label="Sizes" hint="eyebrow · headline · body">
                    <div className="grid grid-cols-3 gap-2">
                      <StyledInput
                        type="number"
                        value={style?.eyebrowFontSize ?? 12}
                        title="Eyebrow size"
                        onChange={(e) => onOverlayStyleChange("eyebrowFontSize", Number(e.target.value))}
                      />
                      <StyledInput
                        type="number"
                        value={style?.fontSize ?? 34}
                        title="Headline size"
                        onChange={(e) => onOverlayStyleChange("fontSize", Number(e.target.value))}
                      />
                      <StyledInput
                        type="number"
                        value={style?.bodyFontSize ?? 15}
                        title="Body size"
                        onChange={(e) => onOverlayStyleChange("bodyFontSize", Number(e.target.value))}
                      />
                    </div>
                  </FieldRow>

                  <FieldRow label="Alignment">
                    <AlignButtons value={style?.textAlign ?? "start"} onChange={(v) => onOverlayStyleChange("textAlign", v)} />
                  </FieldRow>

                  <ColorField
                    label="Color"
                    value={style?.color ?? "#f6f7fb"}
                    onChange={(v) => onOverlayStyleChange("color", v)}
                  />

                  <InlineGroup>
                    <FieldRow label="Opacity">
                      <StyledInput type="number" value={style?.opacity ?? 1} min={0} max={1} step={0.05} onChange={(e) => onOverlayStyleChange("opacity", Number(e.target.value))} />
                    </FieldRow>
                    <FieldRow label="Max width">
                      <StyledInput type="number" value={layout?.width ?? style?.maxWidth ?? 420} onChange={(e) => onOverlayStyleChange("width", Number(e.target.value))} />
                    </FieldRow>
                  </InlineGroup>

                  {/* Theme — sets the overlay's CSS class for light/dark/accent presets */}
                  <FieldRow label="Colour theme" hint="Overrides text/bg defaults">
                    <StyledSelect value={selectedOverlay.content.theme ?? "dark"} onValueChange={(v) => onOverlayFieldChange("theme", v)}>
                      <SelectItem value="light">Light — pale card</SelectItem>
                      <SelectItem value="dark">Dark — dark card</SelectItem>
                      <SelectItem value="accent">Accent — cyan tint</SelectItem>
                    </StyledSelect>
                  </FieldRow>
                </InspectorGroup>
              ) : (
                /* Appearance for media overlays */
                <InspectorGroup title="Appearance" icon={Palette}>
                  <InlineGroup>
                    <FieldRow label="Width">
                      <StyledInput type="number" value={layout?.width ?? 420} onChange={(e) => onOverlayStyleChange("width", Number(e.target.value))} />
                    </FieldRow>
                    <FieldRow label="Opacity">
                      <StyledInput type="number" value={style?.opacity ?? 1} min={0} max={1} step={0.05} onChange={(e) => onOverlayStyleChange("opacity", Number(e.target.value))} />
                    </FieldRow>
                  </InlineGroup>
                </InspectorGroup>
              )}

              {/* ── Background ──────────────────────────────────────── */}
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
                      <SelectItem value="transparent">Glass</SelectItem>
                      <SelectItem value="solid">Solid</SelectItem>
                    </StyledSelect>
                  </FieldRow>
                </InlineGroup>
                <ColorField
                  label="Fill color"
                  value={background?.color ?? "#0d1016"}
                  onChange={(v) => onOverlayStyleChange("backgroundColor", v)}
                />
                <InlineGroup>
                  <FieldRow label="Fill opacity">
                    <StyledInput type="number" value={background?.opacity ?? 0.82} step={0.05} min={0} max={1} onChange={(e) => onOverlayStyleChange("backgroundOpacity", Number(e.target.value))} />
                  </FieldRow>
                  <FieldRow label="Radius">
                    <StyledInput type="number" value={background?.radius ?? 14} onChange={(e) => onOverlayStyleChange("backgroundRadius", Number(e.target.value))} />
                  </FieldRow>
                </InlineGroup>
                <ColorField
                  label="Border color"
                  value={background?.borderColor ?? "#d6f6ff"}
                  onChange={(v) => onOverlayStyleChange("backgroundBorderColor", v)}
                />
                <InlineGroup>
                  <FieldRow label="Border opacity">
                    <StyledInput type="number" value={background?.borderOpacity ?? 0} step={0.05} min={0} max={1} onChange={(e) => onOverlayStyleChange("backgroundBorderOpacity", Number(e.target.value))} />
                  </FieldRow>
                  <FieldRow label="Padding X">
                    <StyledInput type="number" value={background?.paddingX ?? 18} onChange={(e) => onOverlayStyleChange("backgroundPaddingX", Number(e.target.value))} />
                  </FieldRow>
                </InlineGroup>
              </InspectorGroup>

              {/* ── Scene timing & reveal ────────────────────────────── */}
              <InspectorGroup title="Scene timing" icon={SlidersHorizontal}>
                <FieldRow
                  label="Appears at"
                  hint={`${Math.round(selectedOverlay.timing.start * 100)}% scroll`}
                >
                  <Slider
                    value={[selectedOverlay.timing.start]}
                    min={0} max={1} step={0.01}
                    onValueChange={([v]) => onOverlayFieldChange("start", String(v))}
                  />
                </FieldRow>
                <FieldRow
                  label="Disappears at"
                  hint={`${Math.round(selectedOverlay.timing.end * 100)}% scroll`}
                >
                  <Slider
                    value={[selectedOverlay.timing.end]}
                    min={0} max={1} step={0.01}
                    onValueChange={([v]) => onOverlayFieldChange("end", String(v))}
                  />
                </FieldRow>

                <FieldRow label="Reveal animation">
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
                  <FieldRow label="Exit transition">
                    <StyledSelect value={transition?.preset ?? "fade"} onValueChange={(v) => onOverlayTransitionChange("preset", v)}>
                      {transitionPresets.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </StyledSelect>
                  </FieldRow>
                </InlineGroup>
              </InspectorGroup>

            </div>
          </SidebarSection>
        ) : (
          <div className="pt-4 text-center text-xs" style={{ color: "var(--editor-text-dim)" }}>
            Select an overlay in the preview or timeline to edit it.
          </div>
        )}
      </div>
    </aside>
  );
}
