"use client";

import { MonitorSmartphone, MonitorUp, Shrink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function FullscreenPreviewOverlay({
  mode,
  title,
  onModeChange,
  onExit,
}: {
  mode: "desktop" | "mobile";
  title: string;
  onModeChange: (mode: "desktop" | "mobile") => void;
  onExit: () => void;
}) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[var(--z-overlay)] h-20 bg-[linear-gradient(180deg,rgba(4,5,8,0.86),transparent)]" />
      <div className="absolute inset-x-4 top-4 z-[var(--z-overlay)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Badge variant="quiet">Fullscreen</Badge>
          <p className="truncate text-sm text-[var(--foreground-soft)]">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "desktop" ? "secondary" : "quiet"}
            onClick={() => onModeChange("desktop")}
          >
            <MonitorUp className="h-4 w-4" />
            Desktop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "mobile" ? "secondary" : "quiet"}
            onClick={() => onModeChange("mobile")}
          >
            <MonitorSmartphone className="h-4 w-4" />
            Mobile
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onExit}>
            <Shrink className="h-4 w-4" />
            Exit
          </Button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[var(--z-overlay)] h-20 bg-[linear-gradient(0deg,rgba(4,5,8,0.8),transparent)]" />
      <div className="absolute inset-x-4 bottom-4 z-[var(--z-overlay)] flex items-center justify-between gap-3 text-sm text-[var(--foreground-muted)]">
        <span>Press Esc to exit.</span>
        <span>Timeline-linked preview</span>
      </div>
    </>
  );
}
