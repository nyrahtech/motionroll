import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviewStage } from "./preview-stage";
import type { EditorPlaybackController } from "./hooks/useEditorPlayback";

vi.mock("./runtime-preview", () => ({
  RuntimePreview: () => <div data-testid="runtime-preview" />,
}));

function makeManifest() {
  return {
    sections: [
      {
        overlays: [],
      },
    ],
  } as never;
}

function makePlayback(progress = 0.25): EditorPlaybackController {
  return {
    subscribe: () => () => undefined,
    getPlayhead: () => progress,
  };
}

describe("PreviewStage", () => {
  it("keeps the preview canvas clean and does not render playback controls", () => {
    render(
      <PreviewStage
        manifest={makeManifest()}
        mode="desktop"
        playback={makePlayback()}
        isPlaying={false}
        selectedOverlayId=""
        selectedOverlayIds={[]}
        onModeChange={() => undefined}
        onPlayheadChange={() => undefined}
        onPlayToggle={() => undefined}
        onSelectOverlay={() => undefined}
        onOverlayLayoutChange={() => undefined}
        onInlineTextChange={() => undefined}
        onOverlayStyleChange={() => undefined}
        onDuplicateOverlay={() => undefined}
        onDeleteOverlay={() => undefined}
      />,
    );

    expect(screen.getByTestId("runtime-preview")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });
});
