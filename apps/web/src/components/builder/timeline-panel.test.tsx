import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TimelinePanel } from "./timeline-panel";
import type { EditorPlaybackController } from "./hooks/useEditorPlayback";

function makePlayback(progress = 0.25): EditorPlaybackController {
  return {
    subscribe: () => () => undefined,
    getPlayhead: () => progress,
  };
}

describe("timeline panel", () => {
  it("renders the add-layer action in the playback control group as an icon button", () => {
    const markup = renderToStaticMarkup(
      <TimelinePanel
        tracks={[
          {
            id: "scene-track",
            label: "Scene clip",
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
        playback={makePlayback()}
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
        onSetClipEnterAnimationType={() => undefined}
        onSetClipExitAnimationType={() => undefined}
        onSetSceneEnterTransitionPreset={() => undefined}
        onSetSceneExitTransitionPreset={() => undefined}
        onReorderTracks={() => undefined}
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

  it("renders the clip drag ghost inside the timeline scroll area instead of as a fixed page overlay", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline-panel.tsx"),
      "utf8",
    );

    expect(source).toContain('className="pointer-events-none absolute z-[30] overflow-hidden rounded-md border"');
    expect(source).not.toContain('className="pointer-events-none fixed z-[30] overflow-hidden rounded-md border"');
  });

  it("keeps scene clip actions focused on transitions and delete flow", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline", "TimelineTrackRow.tsx"),
      "utf8",
    );

    expect(source).toContain(">Enter animation<");
    expect(source).toContain(">Exit animation<");
    expect(source).toContain(">Delete<");
    expect(source).toContain('label: "Crossfade"');
    expect(source).not.toContain("Scene settings");
    expect(source).not.toContain("Replace scene");
    expect(source).not.toContain("Jump to start");
    expect(source).not.toContain("Jump to end");
  });

  it("keeps the sticky left timeline headers above the playhead and clip chrome", () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline-panel.tsx"),
      "utf8",
    );
    const rulerSource = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline", "TimelineRuler.tsx"),
      "utf8",
    );
    const labelSource = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline", "TimelineLayerLabel.tsx"),
      "utf8",
    );

    expect(panelSource).toContain('className="sticky left-0 z-[60] flex min-h-full w-[168px] shrink-0 flex-col self-stretch"');
    expect(panelSource).toContain('borderRight: "1px solid var(--editor-border)"');
    expect(panelSource).toContain('className="min-h-0 flex-1"');
    expect(panelSource).toContain('className="relative min-w-0 flex-1" style={{ width: totalTrackW }}');
    expect(panelSource).toContain('className="pointer-events-none absolute inset-0 z-[48] overflow-hidden"');
    expect(rulerSource).toContain('className="sticky left-0 z-[60] flex h-8 shrink-0 items-center border-r px-3"');
    expect(rulerSource).toContain('boxShadow: "10px 0 0 var(--editor-panel-elevated)"');
    expect(labelSource).toContain('className="flex h-14 w-full select-none items-center gap-2 px-3"');
  });

  it("keeps the playhead lane visible at the timeline start edge", () => {
    const playheadSource = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline", "TimelinePlayhead.tsx"),
      "utf8",
    );
    const panelSource = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline-panel.tsx"),
      "utf8",
    );

    expect(playheadSource).toContain("const playheadX = TIMELINE_START_OFFSET + usePlaybackProgress(playback) * totalW");
    expect(panelSource).toContain('className="pointer-events-none absolute inset-0 z-[48] overflow-hidden"');
    expect(panelSource).not.toContain('clipPath: "inset(0 0 0 8px)"');
  });

  it("masks the native horizontal scrollbar under the sticky labels instead of rendering a second one", () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline-panel.tsx"),
      "utf8",
    );

    expect(panelSource).toContain('className="pointer-events-auto absolute bottom-0 left-0 z-[70]"');
    expect(panelSource).toContain("width: LABEL_W");
    expect(panelSource).toContain('background: "var(--editor-panel)"');
    expect(panelSource).not.toContain("handleHorizontalScrollbarPointerDown");
  });

  it("keeps the timeline scrolled to the active playhead during playback and jump transport", () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), "src/components/builder/timeline-panel.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("return playback.subscribe(syncScrollToPlayhead)");
    expect(panelSource).toContain("const playheadX = TIMELINE_START_OFFSET + playback.getPlayhead() * totalW");
    expect(panelSource).toContain("scroll.scrollLeft = Math.max(0, playheadX - PLAYHEAD_SCROLL_PADDING)");
  });
});
