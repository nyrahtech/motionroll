import { MediaFrame } from "@/components/motionroll/media-frame";
import { StatusPill } from "@/components/motionroll/surfaces";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeDate } from "@/lib/utils";

type ProjectCardProps = {
  href: string;
  title: string;
  description: string;
  coverUrl: string;
  presetLabel: string;
  sectionCount: number;
  updatedAt: Date | string;
  status: {
    label: string;
    tone: "default" | "accent" | "warning" | "danger";
  };
  featured?: boolean;
};

export function ProjectCard({
  href,
  title,
  description,
  coverUrl,
  presetLabel,
  sectionCount,
  updatedAt,
  status,
  featured = false,
}: ProjectCardProps) {
  return (
    <a href={href} className="group block">
      <Card className="overflow-hidden">
        <div className="relative p-2.5">
          <MediaFrame
            src={coverUrl}
            alt={title}
            aspectClassName={featured ? "aspect-[16/9]" : "aspect-[16/10]"}
            className="transition-transform duration-[var(--motion-slow)] group-hover:scale-[1.01]"
            overlay={
              <>
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-3">
                  <Badge>{presetLabel}</Badge>
                  <StatusPill label={status.label} tone={status.tone} />
                </div>
                <div className="absolute inset-x-3 bottom-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                    {sectionCount} section
                  </p>
                  <p className="mt-1.5 text-lg font-semibold tracking-[-0.04em] text-white">
                    {title}
                  </p>
                </div>
              </>
            }
          />
        </div>
        <CardContent className="space-y-2 pt-0">
          <p className="text-sm leading-6 text-[var(--foreground-muted)]">{description}</p>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[var(--foreground-soft)]">{presetLabel}</span>
            <span className="text-[var(--foreground-faint)]">Edited {formatRelativeDate(updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
