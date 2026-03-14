import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { presetDefinitions } from "@motionroll/shared";
import { TemplateCard } from "@/components/template-picker/template-card";
import { getDemoProjects } from "@/lib/data/projects";
import { getPresetPresentation } from "@/lib/preset-presentation";
import { createProjectAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const demoProjects = await getDemoProjects().catch(() => []);
  const demoByPreset = new Map(demoProjects.map((project) => [project.selectedPreset, project.id]));

  return (
    <div className="min-h-screen" style={{ background: "var(--editor-shell)" }}>
      {/* Header */}
      <header
        className="flex h-14 items-center justify-between border-b px-6"
        style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/library"
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: "var(--editor-text)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </Link>
          <div className="h-4 w-px" style={{ background: "var(--editor-border)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--editor-accent)" }}>MotionRoll</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-8">
        {/* Hero */}
        <div className="mb-8">
          <p
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: "var(--editor-text-dim)" }}
          >
            Templates
          </p>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--editor-text)" }}>
            Pick a visual direction
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
            Templates set the motion defaults, overlay pacing, and copy structure.
            The real work still happens in the Editor.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {presetDefinitions.map((preset) => (
            <TemplateCard
              key={preset.id}
              preset={preset}
              demoProjectId={demoByPreset.get(preset.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
