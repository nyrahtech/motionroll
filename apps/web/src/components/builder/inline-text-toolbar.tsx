"use client";

import React, { type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Italic,
  Layers3,
  Trash2,
  Ungroup,
  Underline,
} from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  canGroup?: boolean;
  canUngroup?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

const fonts = ["Inter", "Manrope", "DM Sans", "Space Grotesk", "Instrument Sans", "Cormorant Garamond"];

type ToolbarIconButtonProps = {
  label: string;
  className: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
};

function ToolbarIconButton({ label, className, onClick, disabled, children }: ToolbarIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

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
  canGroup = false,
  canUngroup = false,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  maxWidth,
}: Props) {
  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 transition-colors hover:bg-[var(--editor-hover)] hover:text-white focus:outline-none";
  const activeBtn = "text-[var(--editor-accent)]";
  const dimBtn = "text-[var(--editor-text-dim)]";
  const dividerClassName = "mx-0.5 h-5 w-px";
  const showActions = Boolean(canGroup || canUngroup || onDuplicate || onDelete);

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
      {isTextStyle ? (
        <>
          <Select
            value={fontFamily}
            onValueChange={(value) => onChange?.({ fontFamily: value })}
          >
            <SelectTrigger className="h-8 min-w-[132px] rounded-md bg-[var(--editor-shell)] px-2 text-xs text-[var(--editor-text)]">
              <SelectValue placeholder="Font" />
            </SelectTrigger>
            <SelectContent>
              {fonts.map((font) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min={10}
            max={180}
            value={fontSize}
            onChange={(event) => onChange?.({ fontSize: Number(event.target.value) })}
            className="h-8 w-14 rounded-md bg-[var(--editor-shell)] px-2 text-xs text-[var(--editor-text)]"
          />

          <ColorPicker
            label="Text color"
            title="Text color"
            variant="icon"
            value={color}
            onLiveChange={(value) => onChange?.({ color: value })}
            onCommitChange={(value) => onChange?.({ color: value })}
            className="h-8 w-8 rounded-md border-transparent bg-transparent p-0 hover:border-transparent hover:bg-transparent"
          />

          <div className={dividerClassName} style={{ background: "var(--editor-border)" }} />

          <ToolbarIconButton
            label="Bold"
            className={cn(btn, fontWeight >= 700 ? activeBtn : dimBtn)}
            onClick={() => onChange?.({ fontWeight: fontWeight >= 700 ? 600 : 700 })}
          >
            <Bold className="h-4 w-4" />
          </ToolbarIconButton>

          <ToolbarIconButton
            label="Italic"
            className={cn(btn, italic ? activeBtn : dimBtn)}
            onClick={() => onChange?.({ italic: !italic })}
          >
            <Italic className="h-4 w-4" />
          </ToolbarIconButton>

          <ToolbarIconButton
            label="Underline"
            className={cn(btn, underline ? activeBtn : dimBtn)}
            onClick={() => onChange?.({ underline: !underline })}
          >
            <Underline className="h-4 w-4" />
          </ToolbarIconButton>

          <div className={dividerClassName} style={{ background: "var(--editor-border)" }} />

          <ToolbarIconButton
            label="Align left"
            className={cn(btn, textAlign === "start" ? activeBtn : dimBtn)}
            onClick={() => onChange?.({ textAlign: "start" })}
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Align center"
            className={cn(btn, textAlign === "center" ? activeBtn : dimBtn)}
            onClick={() => onChange?.({ textAlign: "center" })}
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Align right"
            className={cn(btn, textAlign === "end" ? activeBtn : dimBtn)}
            onClick={() => onChange?.({ textAlign: "end" })}
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarIconButton>
        </>
      ) : null}

      {isTextStyle && showActions ? (
        <div className={dividerClassName} style={{ background: "var(--editor-border)" }} />
      ) : null}

      {onGroup ? (
        <ToolbarIconButton
          label="Group selected items"
          className={cn(btn, canGroup ? dimBtn : "cursor-default opacity-45 text-[var(--editor-text-dim)] hover:bg-transparent hover:text-[var(--editor-text-dim)]")}
          onClick={canGroup ? onGroup : undefined}
          disabled={!canGroup}
        >
          <Layers3 className="h-4 w-4" />
        </ToolbarIconButton>
      ) : null}
      {onUngroup ? (
        <ToolbarIconButton
          label="Ungroup selected item"
          className={cn(btn, canUngroup ? dimBtn : "cursor-default opacity-45 text-[var(--editor-text-dim)] hover:bg-transparent hover:text-[var(--editor-text-dim)]")}
          onClick={canUngroup ? onUngroup : undefined}
          disabled={!canUngroup}
        >
          <Ungroup className="h-4 w-4" />
        </ToolbarIconButton>
      ) : null}
      {(onGroup || onUngroup) && (onDuplicate || onDelete) ? (
        <div className={dividerClassName} style={{ background: "var(--editor-border)" }} />
      ) : null}

      {onDuplicate ? (
        <ToolbarIconButton
          label="Duplicate"
          className={cn(btn, dimBtn)}
          onClick={onDuplicate}
        >
          <Copy className="h-4 w-4" />
        </ToolbarIconButton>
      ) : null}
      {onDelete ? (
        <ToolbarIconButton
          label="Delete"
          className={cn(
            btn,
            dimBtn,
            "hover:text-red-400",
          )}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </ToolbarIconButton>
      ) : null}
    </div>
  );
}
