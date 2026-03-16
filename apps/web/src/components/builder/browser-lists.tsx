import type { ProjectManifest } from "@motionroll/shared";
import { presetDefinitions, type PresetId } from "@motionroll/shared";
import { AssetThumbnail } from "@/components/motionroll/asset-thumbnail";
import { MediaFrame } from "@/components/motionroll/media-frame";
import { Badge } from "@/components/ui/badge";
import { getPresetPresentation } from "@/lib/preset-presentation";
import { getPrimarySourceAsset, getRenderableAssetPreview } from "@/lib/project-assets";
import type { EditorProject } from "./editor-types";
import { BrowserCard, BrowserSection } from "./editor-shell";


const presetThumbnailMap: Record<PresetId, string> = {
  "scroll-sequence": "/thumbnails/scroll-sequence.png",
  "product-reveal": "/thumbnails/product-reveal.png",
  "feature-walkthrough": "/thumbnails/feature-walkthrough.png",
  "before-after": "/thumbnails/before-after.png",
  "device-spin": "/thumbnails/device-spin.png",
  "chaptered-scroll-story": "/thumbnails/chaptered-scroll-story.png",
};

export function PresetList({
  activePresetId,
  currentPresetId,
  onSelect,
  search,
}: {
  activePresetId: PresetId;
  currentPresetId: PresetId;
  onSelect: (presetId: PresetId) => void;
  search: string;
}) {
  const query = search.trim().toLowerCase();
  const presets = presetDefinitions.filter((preset) => {
    if (!query) {
      return true;
    }
    const presentation = getPresetPresentation(preset.id);
    return `${preset.label} ${presentation.bestFor}`.toLowerCase().includes(query);
  });

  return (
    <BrowserSection title="Presets" meta={<Badge variant="quiet">{presets.length}</Badge>}>
      <div className="space-y-2">
        {presets.map((preset) => {
          const presentation = getPresetPresentation(preset.id);
          const selected = activePresetId === preset.id;
          const current = currentPresetId === preset.id;

          return (
            <BrowserCard
              key={preset.id}
              active={selected}
              title={preset.label}
              subtitle={presentation.bestFor}
              meta={
                selected ? (
                  <Badge variant="accent">{current ? "Current" : "Selected"}</Badge>
                ) : current ? (
                  <Badge variant="quiet">Current</Badge>
                ) : undefined
              }
              leading={
                <MediaFrame
                  src={presetThumbnailMap[preset.id]}
                  alt={preset.label}
                  className="w-16 overflow-hidden rounded-[8px]"
                  aspectClassName="aspect-[4/3]"
                />
              }
              onClick={() => onSelect(preset.id)}
            />
          );
        })}
      </div>
    </BrowserSection>
  );
}

export function AssetList({
  project,
  onReplaceSource,
  search,
}: {
  project: EditorProject;
  onReplaceSource: () => void;
  search: string;
}) {
  const query = search.trim().toLowerCase();
  const primarySource = getPrimarySourceAsset(project.assets);
  const primarySourceMetadata = (primarySource?.metadata ?? {}) as {
    originalFilename?: string;
    bytes?: number;
  };

  const filteredAssets = project.assets.filter((asset) => {
    if (!query) {
      return asset.kind !== "source_video";
    }
    return asset.kind.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-3">
      <BrowserSection
        title="Source video"
        meta={primarySource ? <Badge variant="accent">Video</Badge> : <Badge variant="quiet">Empty</Badge>}
      >
        {primarySource ? (
          <div className="space-y-2">
            <AssetThumbnail
              asset={primarySource}
              assets={project.assets}
              label="Source video"
              aspectClassName="aspect-[16/10]"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-white">
                  {primarySourceMetadata.originalFilename ?? "Primary source"}
                </p>
                <p className="text-xs text-[var(--foreground-faint)]">
                  {primarySource.sourceOrigin === "ai_import" ? "AI import" : "Uploaded video"}
                </p>
              </div>
              <button
                type="button"
                onClick={onReplaceSource}
                className="focus-ring rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.05)] px-2 py-1 text-xs text-[var(--foreground-soft)] hover:bg-[rgba(255,255,255,0.08)]"
              >
                Replace
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReplaceSource}
            className="focus-ring w-full rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-left text-sm text-[var(--foreground-soft)] hover:bg-[rgba(255,255,255,0.08)]"
          >
            Import source video
          </button>
        )}
      </BrowserSection>

      <BrowserSection title="Media" meta={<Badge variant="quiet">{filteredAssets.length}</Badge>}>
        <div className="space-y-2">
          {filteredAssets
            .filter((asset) => asset.kind !== "source_video")
            .map((asset) => (
              <BrowserCard
                key={asset.id}
                title={asset.kind.replace(/_/g, " ")}
                subtitle="Processed scene media"
                meta={<Badge variant="quiet">Media</Badge>}
                leading={
                  <AssetThumbnail
                    asset={{
                      ...asset,
                      publicUrl: getRenderableAssetPreview(asset, project.assets),
                    }}
                    assets={project.assets}
                    label={asset.kind}
                    className="w-16"
                    aspectClassName="aspect-[4/3]"
                  />
                }
              />
            ))}
        </div>
      </BrowserSection>
    </div>
  );
}

export function OverlayList({
  section,
  selectedOverlayId,
  onSelect,
  search,
}: {
  section?: ProjectManifest["sections"][number];
  selectedOverlayId: string | null;
  onSelect: (overlayId: string) => void;
  search: string;
}) {
  const overlays = (section?.overlays ?? []).filter((overlay) => {
    if (!search.trim()) {
      return true;
    }

    const query = search.trim().toLowerCase();
    return `${overlay.content.headline} ${overlay.content.eyebrow ?? ""}`
      .toLowerCase()
      .includes(query);
  });

  return (
    <BrowserSection
      title="Text blocks"
      meta={<Badge variant="quiet">{section?.overlays.length ?? 0}</Badge>}
    >
      <div className="space-y-2">
        {overlays.map((overlay) => (
          <BrowserCard
            key={overlay.id}
            active={selectedOverlayId === overlay.id}
            title={overlay.content.headline}
            subtitle={`${Math.round(overlay.timing.start * 100)}% - ${Math.round(overlay.timing.end * 100)}%`}
            meta={<Badge variant="quiet">{overlay.content.eyebrow ?? "Headline"}</Badge>}
            onClick={() => onSelect(overlay.id)}
          />
        ))}
      </div>
    </BrowserSection>
  );
}
