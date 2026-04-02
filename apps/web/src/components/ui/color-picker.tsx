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
  selectionChrome?: boolean;
  className?: string;
};

type PickerVisualState = {
  hex: string;
  hexInputValue: string;
  hue: number;
  saturation: number;
  valueLevel: number;
  opacityValue: number | null;
};

type EyeDropperResult = {
  sRGBHex: string;
};

type EyeDropperInstance = {
  open: () => Promise<EyeDropperResult>;
};

type WindowWithEyeDropper = Window & typeof globalThis & {
  EyeDropper?: new () => EyeDropperInstance;
};

const numberInputClassName = "h-9 rounded-[12px]";
const checkerboardBackgroundImage = [
  "linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%)",
  "linear-gradient(-45deg, rgba(255,255,255,0.08) 25%, transparent 25%)",
  "linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.08) 75%)",
  "linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.08) 75%)",
].join(", ");

const checkerboardBackgroundStyle = {
  backgroundImage: checkerboardBackgroundImage,
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
  backgroundSize: "12px 12px",
} satisfies React.CSSProperties;

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

function toRgbaString(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`;
}

function buildVisualState(value: string, opacity?: number): PickerVisualState {
  const normalized = normalizeHex(value) ?? "#ffffff";
  const hsv = hexToHsv(normalized);
  return {
    hex: normalized,
    hexInputValue: normalized.toUpperCase(),
    hue: hsv.h,
    saturation: hsv.s,
    valueLevel: hsv.v,
    opacityValue: typeof opacity === "number" ? clamp(opacity, 0, 1) : null,
  };
}

function buildVisualStateFromCurrent(
  current: PickerVisualState,
  value: string,
  opacity?: number,
): PickerVisualState {
  const normalized = normalizeHex(value) ?? "#ffffff";
  const nextOpacity = typeof opacity === "number" ? clamp(opacity, 0, 1) : null;
  if (normalized === current.hex) {
    return {
      ...current,
      hex: normalized,
      hexInputValue: normalized.toUpperCase(),
      opacityValue: nextOpacity,
    };
  }
  const hsv = hexToHsv(normalized);
  return {
    hex: normalized,
    hexInputValue: normalized.toUpperCase(),
    hue: hsv.h,
    saturation: hsv.s,
    valueLevel: hsv.v,
    opacityValue: nextOpacity,
  };
}

function visualStatesEqual(left: PickerVisualState, right: PickerVisualState) {
  return (
    left.hex === right.hex &&
    left.hexInputValue === right.hexInputValue &&
    Math.abs(left.hue - right.hue) < 0.0001 &&
    Math.abs(left.saturation - right.saturation) < 0.0001 &&
    Math.abs(left.valueLevel - right.valueLevel) < 0.0001 &&
    left.opacityValue === right.opacityValue
  );
}

function capturePointer(target: EventTarget & { setPointerCapture?: (pointerId: number) => void }, pointerId: number) {
  try {
    target.setPointerCapture?.(pointerId);
  } catch {
    // Pointer capture is best-effort in tests and across browsers.
  }
}

function releasePointer(
  target: EventTarget & {
    hasPointerCapture?: (pointerId: number) => boolean;
    releasePointerCapture?: (pointerId: number) => void;
  },
  pointerId: number,
) {
  try {
    if (target.hasPointerCapture?.(pointerId)) {
      target.releasePointerCapture?.(pointerId);
    }
  } catch {
    // Pointer capture is best-effort in tests and across browsers.
  }
}

function PickerLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
      {children}
    </span>
  );
}

function renderTrackThumb(leftPercent: number) {
  return (
    <span
      className="pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[rgba(255, 255, 255, 0.93)] bg-[rgba(10,12,18,0.98)] shadow-[0_0_0_1px_rgba(8,10,14,0.58),0_3px_10px_rgba(0,0,0,0.28)]"
      style={{ left: `${leftPercent}%` }}
    />
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
  selectionChrome = false,
  className,
}: ColorPickerProps) {
  const [visualState, setVisualState] = React.useState(() => buildVisualState(value, opacity));
  const pickerRef = React.useRef<HTMLDivElement | null>(null);
  const hueTrackRef = React.useRef<HTMLDivElement | null>(null);
  const opacityTrackRef = React.useRef<HTMLDivElement | null>(null);
  const nativeColorInputRef = React.useRef<HTMLInputElement | null>(null);
  const visualStateRef = React.useRef(visualState);
  const frameRef = React.useRef<number | null>(null);
  const pendingLiveHexRef = React.useRef<string | null>(null);
  const pendingOpacityRef = React.useRef<number | null>(null);
  const lastLiveHexRef = React.useRef(visualState.hex);
  const lastOpacityRef = React.useRef(visualState.opacityValue);

  const flushScheduledWork = React.useCallback(() => {
    frameRef.current = null;
    const nextState = visualStateRef.current;
    setVisualState((current) => (visualStatesEqual(current, nextState) ? current : { ...nextState }));

    if (pendingLiveHexRef.current !== null && pendingLiveHexRef.current !== lastLiveHexRef.current) {
      onLiveChange?.(pendingLiveHexRef.current);
      lastLiveHexRef.current = pendingLiveHexRef.current;
    }
    pendingLiveHexRef.current = null;

    if (pendingOpacityRef.current !== null && pendingOpacityRef.current !== lastOpacityRef.current) {
      onOpacityChange?.(pendingOpacityRef.current);
      lastOpacityRef.current = pendingOpacityRef.current;
    }
    pendingOpacityRef.current = null;
  }, [onLiveChange, onOpacityChange]);

  const scheduleVisualFlush = React.useCallback(
    (options?: { liveHex?: string; opacityValue?: number }) => {
      if (options?.liveHex !== undefined) {
        pendingLiveHexRef.current = options.liveHex;
      }
      if (options?.opacityValue !== undefined) {
        pendingOpacityRef.current = options.opacityValue;
      }
      if (frameRef.current !== null) {
        return;
      }
      frameRef.current = requestAnimationFrame(flushScheduledWork);
    },
    [flushScheduledWork],
  );

  const flushScheduledWorkNow = React.useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    flushScheduledWork();
  }, [flushScheduledWork]);

  React.useEffect(() => {
    const nextState = buildVisualStateFromCurrent(visualStateRef.current, value, opacity);
    if (!visualStatesEqual(visualStateRef.current, nextState)) {
      visualStateRef.current = nextState;
      setVisualState(nextState);
    }
  }, [opacity, value]);

  React.useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      pendingLiveHexRef.current = null;
      pendingOpacityRef.current = null;
    },
    [],
  );

  const syncVisualState = React.useCallback(
    (nextState: PickerVisualState, options?: { liveHex?: string; opacityValue?: number }) => {
      visualStateRef.current = nextState;
      scheduleVisualFlush(options);
    },
    [scheduleVisualFlush],
  );

  const updateHexValue = React.useCallback(
    (nextHex: string, commit = false) => {
      const normalized = normalizeHex(nextHex);
      if (!normalized) {
        return;
      }
      const nextHsv = hexToHsv(normalized);
      const nextState: PickerVisualState = {
        ...visualStateRef.current,
        hex: normalized,
        hexInputValue: normalized.toUpperCase(),
        hue: nextHsv.h,
        saturation: nextHsv.s,
        valueLevel: nextHsv.v,
      };
      syncVisualState(nextState, { liveHex: normalized });
      if (commit) {
        flushScheduledWorkNow();
        onCommitChange(normalized);
      }
    },
    [flushScheduledWorkNow, onCommitChange, syncVisualState],
  );

  const updateFromSurfacePointer = React.useCallback(
    (clientX: number, clientY: number, commit = false) => {
      const picker = pickerRef.current;
      if (!picker) {
        return;
      }
      const rect = picker.getBoundingClientRect();
      const saturation = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      const valueLevel = 1 - clamp((clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
      const nextHex = hsvToHex(visualStateRef.current.hue, saturation, valueLevel);
      syncVisualState(
        {
          ...visualStateRef.current,
          saturation,
          valueLevel,
          hex: nextHex,
          hexInputValue: nextHex.toUpperCase(),
        },
        { liveHex: nextHex },
      );
      if (commit) {
        flushScheduledWorkNow();
        onCommitChange(nextHex);
      }
    },
    [flushScheduledWorkNow, onCommitChange, syncVisualState],
  );

  const updateHueFromClient = React.useCallback(
    (clientX: number, commit = false) => {
      const track = hueTrackRef.current;
      if (!track) {
        return;
      }
      const rect = track.getBoundingClientRect();
      const progress = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      const hue = progress * 360;
      const nextHex = hsvToHex(hue, visualStateRef.current.saturation, visualStateRef.current.valueLevel);
      syncVisualState(
        {
          ...visualStateRef.current,
          hue,
          hex: nextHex,
          hexInputValue: nextHex.toUpperCase(),
        },
        { liveHex: nextHex },
      );
      if (commit) {
        flushScheduledWorkNow();
        onCommitChange(nextHex);
      }
    },
    [flushScheduledWorkNow, onCommitChange, syncVisualState],
  );

  const updateOpacityFromClient = React.useCallback(
    (clientX: number, flush = false) => {
      const track = opacityTrackRef.current;
      if (!track || typeof visualStateRef.current.opacityValue !== "number") {
        return;
      }
      const rect = track.getBoundingClientRect();
      const progress = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      syncVisualState(
        {
          ...visualStateRef.current,
          opacityValue: progress,
        },
        { opacityValue: progress },
      );
      if (flush) {
        flushScheduledWorkNow();
      }
    },
    [flushScheduledWorkNow, syncVisualState],
  );

  const handleHexInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.currentTarget.value.toUpperCase();
    const nextState = {
      ...visualStateRef.current,
      hexInputValue: nextValue,
    };
    visualStateRef.current = nextState;
    setVisualState(nextState);
    const normalized = normalizeHex(nextValue);
    if (normalized) {
      updateHexValue(normalized);
    }
  };

  const handleHexInputBlur = () => {
    const normalized = normalizeHex(visualStateRef.current.hexInputValue) ?? visualStateRef.current.hex;
    updateHexValue(normalized, true);
  };

  const handleHueKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentHue = visualStateRef.current.hue;
    let nextHue = currentHue;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextHue = currentHue - 5;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") nextHue = currentHue + 5;
    else if (event.key === "Home") nextHue = 0;
    else if (event.key === "End") nextHue = 360;
    else return;

    event.preventDefault();
    const boundedHue = clamp(nextHue, 0, 360);
    const nextHex = hsvToHex(
      boundedHue,
      visualStateRef.current.saturation,
      visualStateRef.current.valueLevel,
    );
    syncVisualState(
      {
        ...visualStateRef.current,
        hue: boundedHue,
        hex: nextHex,
        hexInputValue: nextHex.toUpperCase(),
      },
      { liveHex: nextHex },
    );
    flushScheduledWorkNow();
    onCommitChange(nextHex);
  };

  const handleOpacityKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (typeof visualStateRef.current.opacityValue !== "number") {
      return;
    }
    const currentOpacity = visualStateRef.current.opacityValue;
    let nextOpacity = currentOpacity;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextOpacity = currentOpacity - 0.05;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") nextOpacity = currentOpacity + 0.05;
    else if (event.key === "Home") nextOpacity = 0;
    else if (event.key === "End") nextOpacity = 1;
    else return;

    event.preventDefault();
    syncVisualState(
      {
        ...visualStateRef.current,
        opacityValue: clamp(nextOpacity, 0, 1),
      },
      { opacityValue: clamp(nextOpacity, 0, 1) },
    );
    flushScheduledWorkNow();
  };

  const handleScreenColorPick = React.useCallback(async () => {
    const win = window as WindowWithEyeDropper;
    if (win.EyeDropper) {
      try {
        const picker = new win.EyeDropper();
        const result = await picker.open();
        updateHexValue(result.sRGBHex, true);
        return;
      } catch (error) {
        const maybeAbort = error as { name?: string } | null;
        if (maybeAbort?.name === "AbortError") {
          return;
        }
      }
    }
    nativeColorInputRef.current?.click();
  }, [updateHexValue]);

  const pickerCursorStyle = {
    left: `${visualState.saturation * 100}%`,
    top: `${(1 - visualState.valueLevel) * 100}%`,
  };
  const hueThumbPercent = clamp((visualState.hue / 360) * 100, 0, 100);
  const opacityThumbPercent =
    typeof visualState.opacityValue === "number"
      ? clamp(visualState.opacityValue * 100, 0, 100)
      : null;

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
          data-overlay-selection-chrome={selectionChrome ? "true" : undefined}
          onOpenAutoFocus={(event) => {
            if (selectionChrome) {
              event.preventDefault();
            }
          }}
          onCloseAutoFocus={(event) => {
            if (selectionChrome) {
              event.preventDefault();
            }
          }}
          className="z-[2147483646] w-[248px] rounded-[14px] border border-[var(--editor-border)] bg-[var(--editor-panel-elevated)] p-3 shadow-lg"
        >
          <div className="space-y-3">
            <div className="grid gap-2">
              <div
                ref={pickerRef}
                className="relative h-32 w-full cursor-crosshair overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)]"
                style={{
                  backgroundImage:
                    "linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)",
                  backgroundColor: `hsl(${visualState.hue} 100% 50%)`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  updateFromSurfacePointer(event.clientX, event.clientY);
                  capturePointer(event.currentTarget, event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (event.buttons === 0) {
                    return;
                  }
                  updateFromSurfacePointer(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  updateFromSurfacePointer(event.clientX, event.clientY, true);
                  releasePointer(event.currentTarget, event.pointerId);
                }}
              >
                <span
                  className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_rgba(8,10,14,0.6)]"
                  style={pickerCursorStyle}
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <PickerLabel>Hue</PickerLabel>
                </div>
                <div
                  ref={hueTrackRef}
                  aria-label={`${label} hue`}
                  role="slider"
                  tabIndex={0}
                  aria-valuemin={0}
                  aria-valuemax={360}
                  aria-valuenow={Math.round(visualState.hue)}
                  className="relative h-4 w-full cursor-pointer overflow-visible"
                  onKeyDown={handleHueKeyDown}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    updateHueFromClient(event.clientX);
                    capturePointer(event.currentTarget, event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (event.buttons === 0) {
                      return;
                    }
                    updateHueFromClient(event.clientX);
                  }}
                  onPointerUp={(event) => {
                    updateHueFromClient(event.clientX, true);
                    releasePointer(event.currentTarget, event.pointerId);
                  }}
                >
                  <span
                    className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    style={{
                      background:
                        "linear-gradient(90deg, #ff4d4d 0%, #ffd54a 17%, #5cff79 33%, #37d2ff 50%, #4e7dff 67%, #ca63ff 83%, #ff4d4d 100%)",
                    }}
                  />
                  {renderTrackThumb(hueThumbPercent)}
                </div>
              </div>

              {typeof visualState.opacityValue === "number" && onOpacityChange ? (
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <PickerLabel>Opacity</PickerLabel>
                    <span className="text-[11px] font-medium text-[var(--foreground-muted)]">
                      {Math.round(visualState.opacityValue * 100)}%
                    </span>
                  </div>
                  <div
                    ref={opacityTrackRef}
                    aria-label={`${label} opacity`}
                    role="slider"
                    tabIndex={0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(visualState.opacityValue * 100)}
                    className="relative h-4 w-full cursor-pointer overflow-visible"
                    onKeyDown={handleOpacityKeyDown}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      updateOpacityFromClient(event.clientX);
                      capturePointer(event.currentTarget, event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (event.buttons === 0) {
                        return;
                      }
                      updateOpacityFromClient(event.clientX);
                    }}
                    onPointerUp={(event) => {
                      updateOpacityFromClient(event.clientX, true);
                      releasePointer(event.currentTarget, event.pointerId);
                    }}
                  >
                    <span
                      className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      style={{
                        ...checkerboardBackgroundStyle,
                        backgroundColor: "rgba(11, 15, 22, 0.85)",
                      }}
                    >
                      <span
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(90deg, ${toRgbaString(visualState.hex, 0)} 0%, ${toRgbaString(visualState.hex, 1)} 100%)`,
                        }}
                      />
                    </span>
                    {opacityThumbPercent !== null ? renderTrackThumb(opacityThumbPercent) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1 grid gap-2">
                <PickerLabel>Hex</PickerLabel>
                <Input
                  className={numberInputClassName}
                  value={visualState.hexInputValue}
                  onChange={handleHexInputChange}
                  onBlur={handleHexInputBlur}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleHexInputBlur();
                    }
                  }}
                />
              </label>

              <div className="grid gap-2">
                <PickerLabel>Pick</PickerLabel>
                <button
                  type="button"
                  aria-label={`${label} screen color picker`}
                  className="focus-ring flex h-9 w-10 items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] transition-colors hover:border-[rgba(255,255,255,0.14)]"
                  onClick={() => {
                    void handleScreenColorPick();
                  }}
                >
                  <span
                    className="relative h-5 w-5 overflow-hidden rounded-full border border-[rgba(255,255,255,0.14)]"
                    style={checkerboardBackgroundStyle}
                  >
                    <span
                      className="absolute inset-0"
                      style={{ backgroundColor: visualState.hex }}
                    />
                  </span>
                </button>
                <input
                  ref={nativeColorInputRef}
                  aria-label={`${label} native color input`}
                  type="color"
                  value={visualState.hex}
                  tabIndex={-1}
                  className="sr-only"
                  onInput={(event) => updateHexValue(event.currentTarget.value)}
                  onChange={(event) => updateHexValue(event.currentTarget.value, true)}
                />
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
