"use client";

import {
  AlignCenter, AlignLeft, AlignRight,
  Bold, Copy, Italic, Move, Trash2, Underline,
} from "lucide-react";

type Props = {
  position: { top: number; left: number };
  maxWidth?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  color?: string;
  italic?: boolean;
  underline?: boolean;
  textAlign?: "start" | "center" | "end";
  isTextStyle?: boolean;
  onChange?: (changes: Partial<{
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    color: string;
    italic: boolean;
    underline: boolean;
    textAlign: "start" | "center" | "end";
  }>) => void;
  onDragStart?: (e: React.PointerEvent) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

const fonts = ["Inter", "Manrope", "DM Sans", "Space Grotesk", "Instrument Sans", "Cormorant Garamond"];

export function InlineTextToolbar({
  position,
  fontFamily = "Inter",
  fontWeight = 600,
  fontSize = 34,
  color = "#f6f7fb",
  italic = false,
  underline = false,
  textAlign = "start",
  isTextStyle = true,
  onChange,
  onDragStart,
  onDuplicate,
  onDelete,
  maxWidth,
}: Props) {
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--editor-hover)] hover:text-white focus:outline-none";
  const activeBtn = "text-[var(--editor-accent)]";
  const dimBtn = "text-[var(--editor-text-dim)]";

  // Themed select — dark bg, editor border, editor text color
  const selectCls =
    "h-8 rounded-md border bg-[var(--editor-shell)] px-2 text-xs text-[var(--editor-text)] outline-none cursor-pointer appearance-none";
  const selectStyle = { borderColor: "var(--editor-border)" };

  return (
    <div
      className="absolute z-30 flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border px-1.5 py-1 shadow-2xl backdrop-blur no-scrollbar"
      style={{
        top: Math.max(8, position.top),
        left: Math.max(8, position.left),
        maxWidth: maxWidth ? `${Math.max(220, maxWidth - 16)}px` : undefined,
        background: "rgba(10,12,18,0.96)",
        borderColor: "var(--editor-border)",
      }}
    >
      {/* Drag handle — icon only, pointer-down forwarded to parent */}
      {onDragStart ? (
        <button
          type="button"
          onPointerDown={onDragStart}
          className={`${btn} ${dimBtn} cursor-grab mr-0.5`}
          title="Drag overlay"
        >
          <Move className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {isTextStyle ? (
        <>
          {/* Font family — themed select */}
          <select
            value={fontFamily}
            onChange={(e) => onChange?.({ fontFamily: e.target.value })}
            className={selectCls}
            style={selectStyle}
          >
            {fonts.map((f) => (
              <option key={f} value={f} style={{ background: "var(--editor-panel-elevated)", color: "var(--editor-text)" }}>
                {f}
              </option>
            ))}
          </select>

          {/* Font size */}
          <input
            type="number"
            min={10}
            max={180}
            value={fontSize}
            onChange={(e) => onChange?.({ fontSize: Number(e.target.value) })}
            className="h-8 w-14 rounded-md border bg-[var(--editor-shell)] px-2 text-xs text-[var(--editor-text)] outline-none"
            style={{ borderColor: "var(--editor-border)" }}
          />

          {/* Color */}
          <input
            type="color"
            value={color}
            onChange={(e) => onChange?.({ color: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded-md border bg-transparent"
            style={{ borderColor: "var(--editor-border)", padding: "2px" }}
            title="Text color"
          />

          <div className="mx-0.5 h-5 w-px" style={{ background: "var(--editor-border)" }} />

          {/* Bold */}
          <button
            type="button"
            className={`${btn} ${fontWeight >= 700 ? activeBtn : dimBtn}`}
            onClick={() => onChange?.({ fontWeight: fontWeight >= 700 ? 600 : 700 })}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>

          {/* Italic */}
          <button
            type="button"
            className={`${btn} ${italic ? activeBtn : dimBtn}`}
            onClick={() => onChange?.({ italic: !italic })}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>

          {/* Underline */}
          <button
            type="button"
            className={`${btn} ${underline ? activeBtn : dimBtn}`}
            onClick={() => onChange?.({ underline: !underline })}
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>

          <div className="mx-0.5 h-5 w-px" style={{ background: "var(--editor-border)" }} />

          {/* Alignment */}
          <button type="button" className={`${btn} ${textAlign === "start" ? activeBtn : dimBtn}`} onClick={() => onChange?.({ textAlign: "start" })} title="Align left">
            <AlignLeft className="h-4 w-4" />
          </button>
          <button type="button" className={`${btn} ${textAlign === "center" ? activeBtn : dimBtn}`} onClick={() => onChange?.({ textAlign: "center" })} title="Align center">
            <AlignCenter className="h-4 w-4" />
          </button>
          <button type="button" className={`${btn} ${textAlign === "end" ? activeBtn : dimBtn}`} onClick={() => onChange?.({ textAlign: "end" })} title="Align right">
            <AlignRight className="h-4 w-4" />
          </button>
        </>
      ) : null}

      <div className="mx-0.5 h-5 w-px" style={{ background: "var(--editor-border)" }} />

      {onDuplicate ? (
        <button type="button" className={`${btn} ${dimBtn}`} onClick={onDuplicate} title="Duplicate">
          <Copy className="h-4 w-4" />
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" className={`${btn} ${dimBtn} hover:text-red-400`} onClick={onDelete} title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
