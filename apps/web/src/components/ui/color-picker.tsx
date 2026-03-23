"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Input } from "./input";
import { cn } from "../../lib/utils";

type ColorPickerProps = {
  value: string;
  label?: string;
  title?: string;
  variant?: "field" | "icon";
  onLiveChange?: (value: string) => void;
  onCommitChange: (value: string) => void;
  opacity?: number;
  onOpacityChange?: (value: number) => void;
  className?: string;
};

const numberInputClassName = "h-9 rounded-[12px]";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampChannel = (value: number) => clamp(Math.round(value), 0, 255);

function normalizeHex(value: string) {
  const candidate = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(candidate)) {
    return `#${candidate.toLowerCase()}`;
  }
  if (/^[0-9a-f]{3}$/i.test(candidate)) {
    return `#${candidate
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }
  return null;
}

function hexToRgb(value: string) {
  const normalized = normalizeHex(value) ?? "#ffffff";
  const channelValue = (offset: number) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16);
  return {
    r: channelValue(1),
    g: channelValue(3),
    b: channelValue(5),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  return {
    h: hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToRgb(h: number, s: number, v: number) {
  const hue = ((h % 360) + 360) % 360;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = v - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    r: clampChannel((red + match) * 255),
    g: clampChannel((green + match) * 255),
    b: clampChannel((blue + match) * 255),
  };
}

function hexToHsv(value: string) {
  const rgb = hexToRgb(value);
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

function hsvToHex(h: number, s: number, v: number) {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function PickerLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
      {children}
    </span>
  );
}

export function ColorPicker({
  value,
  label = "Color",
  title,
  variant = "field",
  onLiveChange,
  onCommitChange,
  opacity,
  onOpacityChange,
  className,
}: ColorPickerProps) {
  const [draftHex, setDraftHex] = React.useState(value);
  const [hexInputValue, setHexInputValue] = React.useState(value.toUpperCase());
  const [draftHsv, setDraftHsv] = React.useState(() => hexToHsv(value));
  const pickerRef = React.useRef<HTMLDivElement | null>(null);
  const draftHexRef = React.useRef(draftHex);

  React.useEffect(() => {
    const normalized = normalizeHex(value) ?? "#ffffff";
    setDraftHex(normalized);
    setHexInputValue(normalized.toUpperCase());
    setDraftHsv(hexToHsv(normalized));
  }, [value]);

  React.useEffect(() => {
    draftHexRef.current = draftHex;
  }, [draftHex]);

  const applyHex = React.useCallback(
    (nextHex: string, commit = false) => {
      setDraftHex(nextHex);
      setHexInputValue(nextHex.toUpperCase());
      setDraftHsv(hexToHsv(nextHex));
      onLiveChange?.(nextHex);
      if (commit) {
        onCommitChange(nextHex);
      }
    },
    [onCommitChange, onLiveChange],
  );

  const updateFromPointer = React.useCallback(
    (clientX: number, clientY: number, commit = false) => {
      const picker = pickerRef.current;
      if (!picker) {
        return;
      }

      const rect = picker.getBoundingClientRect();
      const saturation = clamp((clientX - rect.left) / rect.width, 0, 1);
      const valueLevel = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
      const nextHex = hsvToHex(draftHsv.h, saturation, valueLevel);
      setDraftHsv((current) => ({ ...current, s: saturation, v: valueLevel }));
      setDraftHex(nextHex);
      setHexInputValue(nextHex.toUpperCase());
      onLiveChange?.(nextHex);
      if (commit) {
        onCommitChange(nextHex);
      }
    },
    [draftHsv.h, onCommitChange, onLiveChange],
  );

  const handlePickerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateFromPointer(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePickerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons === 0) {
      return;
    }
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePickerPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    updateFromPointer(event.clientX, event.clientY, true);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const pickerCursorStyle = {
    left: `${draftHsv.s * 100}%`,
    top: `${(1 - draftHsv.v) * 100}%`,
  };

  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        className={cn(
          "focus-ring relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.035)] transition-colors hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.05)]",
          className,
        )}
        title={title ?? label}
        aria-label={label}
      >
        <span
          className="h-4 w-4 rounded-full border border-[rgba(255,255,255,0.14)]"
          style={{ backgroundColor: value }}
        />
      </button>
    ) : (
      <button
        type="button"
        className={cn(
          "focus-ring flex h-9 w-full items-center justify-between gap-3 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[rgba(255,255,255,0.12)]",
          className,
        )}
        title={title ?? label}
        aria-label={label}
      >
        <span className="truncate">{value.toUpperCase()}</span>
        <span
          className="h-4 w-4 rounded-full border border-[rgba(255,255,255,0.14)]"
          style={{ backgroundColor: value }}
        />
      </button>
    );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-50 w-[248px] rounded-[14px] border border-[var(--editor-border)] bg-[var(--editor-panel-elevated)] p-3 shadow-lg"
        >
          <div className="space-y-3">
            <div className="grid gap-2">
              <div
                ref={pickerRef}
                className="relative h-32 w-full cursor-crosshair overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)]"
                style={{
                  backgroundImage:
                    "linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)",
                  backgroundColor: `hsl(${draftHsv.h} 100% 50%)`,
                }}
                onPointerDown={handlePickerPointerDown}
                onPointerMove={handlePickerPointerMove}
                onPointerUp={handlePickerPointerUp}
              >
                <span
                  className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_rgba(8,10,14,0.6)]"
                  style={pickerCursorStyle}
                />
              </div>
              <input
                aria-label={`${label} hue`}
                type="range"
                min="0"
                max="360"
                step="1"
                value={Math.round(draftHsv.h)}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-transparent accent-[var(--editor-accent)]"
                style={{
                  background:
                    "linear-gradient(90deg, #ff4d4d 0%, #ffd54a 17%, #5cff79 33%, #37d2ff 50%, #4e7dff 67%, #ca63ff 83%, #ff4d4d 100%)",
                }}
                onChange={(event) => {
                  const nextHue = Number(event.currentTarget.value);
                  const nextHex = hsvToHex(nextHue, draftHsv.s, draftHsv.v);
                  setDraftHsv((current) => ({ ...current, h: nextHue }));
                  setDraftHex(nextHex);
                  setHexInputValue(nextHex.toUpperCase());
                  onLiveChange?.(nextHex);
                }}
                onPointerUp={() => onCommitChange(draftHexRef.current)}
                onBlur={() => onCommitChange(draftHexRef.current)}
              />
            </div>
            <div
              className={cn(
                "grid gap-3",
                typeof opacity === "number" && onOpacityChange
                  ? "grid-cols-[minmax(0,1fr)_92px]"
                  : undefined,
              )}
            >
              <label className="grid gap-2">
                <PickerLabel>Hex</PickerLabel>
                <Input
                  className={numberInputClassName}
                  value={hexInputValue}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value.toUpperCase();
                    setHexInputValue(nextValue);
                    const normalized = normalizeHex(nextValue);
                    if (normalized) {
                      setDraftHex(normalized);
                      setDraftHsv(hexToHsv(normalized));
                      onLiveChange?.(normalized);
                    }
                  }}
                  onBlur={() => {
                    const normalized = normalizeHex(hexInputValue) ?? draftHex;
                    applyHex(normalized, true);
                  }}
                />
              </label>
              {typeof opacity === "number" && onOpacityChange ? (
                <label className="grid gap-2">
                  <PickerLabel>Opacity</PickerLabel>
                  <Input
                    className={numberInputClassName}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(opacity * 100)}
                    onChange={(event) =>
                      onOpacityChange(clamp(Number(event.currentTarget.value), 0, 100) / 100)
                    }
                  />
                </label>
              ) : null}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
