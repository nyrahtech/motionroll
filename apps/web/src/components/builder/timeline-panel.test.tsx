import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TimelinePanel } from "./timeline-panel";

describe("timeline panel", () => {
  it("renders the add-layer action in the playback control group as an icon button", () => {
    const markup = renderToStaticMarkup(
      <TimelinePanel
        tracks={[
          {
            id: "scene-track",
            label: "Scene range",
            type: "section",
            clips: [
              {
                id: "scene-clip",
                label: "Scene",
                trackType: "section",
                start: 0,
                end: 1,
              },
            ],
          },
          {
            id: "layer-track",
            label: "Layer 1",
            type: "layer",
            clips: [],
          },
        ]}
        selection={null}
        selectedClipIds={[]}
        playhead={0.25}
        durationSeconds={8}
        isPlaying={false}
        canUndo
        canRedo
        canGroupSelection={false}
        canUngroupSelection={false}
        onPlayToggle={() => undefined}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onGroupSelection={() => undefined}
        onUngroupSelection={() => undefined}
        onPlayheadChange={() => undefined}
        onSelectionChange={() => undefined}
        onClipTimingChange={() => undefined}
        onCommitClipMove={() => undefined}
        onAddLayer={() => undefined}
        onDeleteLayer={() => undefined}
        onAddAtPlayhead={() => undefined}
        onDuplicateClip={() => undefined}
        onDeleteClip={() => undefined}
        onMoveClipToLayer={() => undefined}
        onMoveClipToNewLayer={() => undefined}
        onReorderTracks={() => undefined}
        onSetClipTransitionPreset={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Add layer"');
    expect(markup).toContain('title="Add layer"');
    expect(markup).toContain('title="Jump to start"');
    expect(markup).toContain('title="Previous frame"');
    expect(markup).toContain('title="Start playback"');
    expect(markup).toContain('title="Next frame"');
    expect(markup).toContain('title="Jump to end"');
    expect(markup).toContain("Layers");
    expect(markup).not.toContain(">Layer</button>");
  });
});
