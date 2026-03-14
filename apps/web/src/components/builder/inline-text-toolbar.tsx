"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Trash2, Copy } from "lucide-react";

type Props = {
  position: { top: number; left: number };
  maxWidth?: number;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  italic: boolean;
  textAlign: "start" | "center" | "end";
  onChange: (changes: Partial<{
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    color: string;
    italic: boolean;
    textAlign: "start" | "center" | "end";
  }>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

const fonts = ["Inter", "Manrope", "DM Sans", "Space Grotesk", "Instrument Sans", "Cormorant Garamond"];

export function InlineTextToolbar({
  position,
  fontFamily,
  fontWeight,
  fontSize,
  color,
  italic,
  textAlign,
  onChange,
  onDuplicate,
  onDelete,
  maxWidth,
}: Props) {
  const iconClass =
    "flex h-8 w-8 items-center justify-center rounded-md text-[var(--editor-text-dim)] transition-colors hover:bg-[var(--editor-hover)] hover:text-white cursor-pointer";

  return (
    <div
      className="absolute z-30 flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border px-2 py-1 shadow-2xl backdrop-blur no-scrollbar"
      style={{
        top: Math.max(8, position.top),
        left: Math.max(8, position.left),
        maxWidth: maxWidth ? `${Math.max(280, maxWidth - 16)}px` : undefined,
        background: "rgba(10,12,18,0.92)",
        borderColor: "var(--editor-border)",
      }}
    >
      <select
        value={fontFamily}
        onChange={(event) => onChange({ fontFamily: event.target.value })}
        className="h-8 rounded-md border bg-[rgba(255,255,255,0.03)] px-2 text-xs text-white outline-none cursor-pointer"
        style={{ borderColor: "var(--editor-border)" }}
      >
        {fonts.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>
      <select
        value={String(fontWeight)}
        onChange={(event) => onChange({ fontWeight: Number(event.target.value) })}
        className="h-8 rounded-md border bg-[rgba(255,255,255,0.03)] px-2 text-xs text-white outline-none cursor-pointer"
        style={{ borderColor: "var(--editor-border)" }}
      >
        {[400, 500, 600, 700, 800].map((weight) => (
          <option key={weight} value={weight}>{weight}</option>
        ))}
      </select>
      <input
        type="number"
        min={10}
        max={180}
        value={fontSize}
        onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
        className="h-8 w-16 rounded-md border bg-[rgba(255,255,255,0.03)] px-2 text-xs text-white outline-none"
        style={{ borderColor: "var(--editor-border)" }}
      />
      <input
        type="color"
        value={color}
        onChange={(event) => onChange({ color: event.target.value })}
        className="h-8 w-8 cursor-pointer rounded-md border bg-transparent p-1"
        style={{ borderColor: "var(--editor-border)" }}
      />
      <button
        type="button"
        className={iconClass}
        style={{ color: italic ? "var(--editor-accent)" : undefined }}
        onClick={() => onChange({ italic: !italic })}
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={iconClass}
        style={{ color: fontWeight >= 700 ? "var(--editor-accent)" : undefined }}
        onClick={() => onChange({ fontWeight: fontWeight >= 700 ? 600 : 700 })}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" className={iconClass} onClick={() => onChange({ textAlign: "start" })}>
        <AlignLeft className={`h-4 w-4 ${textAlign === "start" ? "text-[var(--editor-accent)]" : ""}`} />
      </button>
      <button type="button" className={iconClass} onClick={() => onChange({ textAlign: "center" })}>
        <AlignCenter className={`h-4 w-4 ${textAlign === "center" ? "text-[var(--editor-accent)]" : ""}`} />
      </button>
      <button type="button" className={iconClass} onClick={() => onChange({ textAlign: "end" })}>
        <AlignRight className={`h-4 w-4 ${textAlign === "end" ? "text-[var(--editor-accent)]" : ""}`} />
      </button>
      <div className="mx-1 h-5 w-px bg-[var(--editor-border)]" />
      {onDuplicate ? (
        <button type="button" className={iconClass} onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" className={iconClass} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
