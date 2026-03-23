import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

function getMediaKind(src: string) {
  const normalized = src.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(mp4|webm|mov|m4v)$/.test(normalized)) {
    return "video";
  }

  return "image";
}

export function MediaFrame({
  src,
  alt,
  className,
  priority = false,
  overlay,
  aspectClassName = "aspect-[16/10]",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  overlay?: ReactNode;
  aspectClassName?: string;
}) {
  const mediaKind = src ? getMediaKind(src) : "image";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--panel-bg-preview)]",
        aspectClassName,
        className,
      )}
    >
      {src ? (
        mediaKind === "video" ? (
          <video
            src={src}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#151922,#0a0c12)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.38))]" />
      {overlay}
    </div>
  );
}
