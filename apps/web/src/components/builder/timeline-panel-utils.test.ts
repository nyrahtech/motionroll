import { describe, expect, it } from "vitest";
import type { TimelineTrackModel } from "./timeline-model";
import {
  getFrameStripSampleCount,
  getLayerRowDescriptors,
} from "./timeline-panel-utils";

describe("timeline panel utils", () => {
  it("returns no frame strip samples for narrow clips and clamps wider clips", () => {
    expect(getFrameStripSampleCount(120)).toBe(0);
    expect(getFrameStripSampleCount(360, 24, 0, 1)).toBeGreaterThanOrEqual(4);
    expect(getFrameStripSampleCount(2_400, 240, 0, 1)).toBeLessThanOrEqual(18);
  });

  it("derives row descriptors for drop zones and clip move previews", () => {
    const layerTracks: TimelineTrackModel[] = [
      {
        id: "track-layer-1",
        label: "Layer 1",
        type: "layer",
        clips: [],
      },
      {
        id: "track-layer-2",
        label: "Layer 2",
        type: "layer",
        clips: [],
      },
    ];

    const descriptors = getLayerRowDescriptors({
      layerTracks,
      dropTrackIndex: 1,
      draggingTrackIndex: 0,
      dragGhost: null,
      draggingClipMode: "move",
      draggingClipId: "layer-clip-1",
      clipMovePreview: {
        draggedClipId: "layer-clip-1",
        sourceTrackIndex: 0,
        sourceLayerId: 0,
        targetTrackIndex: 1,
        targetLayerId: 1,
        targetStart: 0.2,
        targetEnd: 0.45,
        targetIndex: 0,
        isCrossLayerMove: true,
        isSnapped: true,
      },
      recentlyAddedTrackId: "track-layer-2",
      deletingTrackId: null,
      durationSeconds: 12,
      totalW: 1000,
    });

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]?.isBlockMoveDrag).toBe(true);
    expect(descriptors[0]?.showInsertionCue).toBe(false);
    expect(descriptors[1]?.showDropZone).toBe(false);
    expect(descriptors[1]?.isRecentlyAdded).toBe(true);
    expect(descriptors[1]?.previewLeft).toBeGreaterThan(0);
    expect(descriptors[1]?.previewWidth).toBeGreaterThan(0);
    expect(descriptors[1]?.previewTimeLabel).toBe("00:02");
  });
});
