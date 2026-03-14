import { MediaFrame } from "@/components/motionroll/media-frame";
import { Badge } from "@/components/ui/badge";
import { getRenderableAssetPreview } from "@/lib/project-assets";

type AssetThumbnailProps = {
  asset: {
    kind: string;
    publicUrl: string;
  };
  assets: Array<{
    kind: string;
    publicUrl: string;
  }>;
  label?: string;
  aspectClassName?: string;
  className?: string;
};

export function AssetThumbnail({
  asset,
  assets,
  label,
  aspectClassName = "aspect-[16/10]",
  className,
}: AssetThumbnailProps) {
  const previewUrl = getRenderableAssetPreview(asset, assets);

  return (
    <MediaFrame
      src={previewUrl}
      alt={label ?? asset.kind}
      className={className}
      aspectClassName={aspectClassName}
      overlay={
        <div className="absolute inset-x-3 top-3 flex justify-between gap-2">
          <Badge variant="quiet">{label ?? asset.kind}</Badge>
        </div>
      }
    />
  );
}
