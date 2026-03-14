import Link from "next/link";
import type { PresetDefinition } from "@motionroll/shared";
import { createProjectAction } from "@/app/actions";
import { MediaFrame } from "@/components/motionroll/media-frame";
import { StatusPill } from "@/components/motionroll/surfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPresetPresentation } from "@/lib/preset-presentation";

export function TemplateCard({ preset, demoProjectId }: { preset: PresetDefinition; demoProjectId?: string }) {
  const presentation = getPresetPresentation(preset.id);
  const recommended = preset.id === "product-reveal";

  return (
    <Card className="overflow-hidden">
      <div className="p-2.5">
        <MediaFrame
          src={preset.previewThumbnail}
          alt={preset.label}
          aspectClassName="aspect-[4/3]"
          className="transition-transform duration-[var(--motion-slow)] hover:scale-[1.01]"
          overlay={
            <>
              <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-3">
                <Badge>{presentation.category}</Badge>
                {recommended ? <StatusPill label="Recommended" tone="accent" /> : <Badge variant="quiet">{presentation.pace}</Badge>}
              </div>
              <div className="absolute inset-x-3 bottom-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--foreground-muted)]">{presentation.heroLabel}</p>
                <p className="mt-1.5 text-lg font-semibold tracking-[-0.04em] text-white">{preset.label}</p>
              </div>
            </>
          }
        />
      </div>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-2">
          <p className="text-sm leading-6 text-[var(--foreground-muted)]">{presentation.bestFor}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="quiet">{presentation.sourceHint}</Badge>
            {preset.exposedControls.slice(0, 2).map((control) => (
              <Badge key={control.id} variant="quiet">{control.label}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={createProjectAction}>
            <input type="hidden" name="presetId" value={preset.id} />
            <Button type="submit">Create project</Button>
          </form>
          {demoProjectId ? (
            <Button asChild variant="secondary">
              <Link href={`/projects/${demoProjectId}`}>Open demo</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
