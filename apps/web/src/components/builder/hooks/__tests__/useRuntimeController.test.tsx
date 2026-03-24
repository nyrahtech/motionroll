import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeController } from "../useRuntimeController";
import type { EditorPlaybackController } from "../useEditorPlayback";

const { createScrollSection } = vi.hoisted(() => ({
  createScrollSection: vi.fn(),
}));

vi.mock("@motionroll/runtime", () => ({
  createScrollSection,
}));

function makeManifest() {
  return {
    sections: [
      {
        overlays: [
          {
            id: "overlay-1",
            timing: { start: 0.2, end: 0.5 },
          },
        ],
      },
    ],
  } as const;
}

function createPlayback(initial = 0.2): EditorPlaybackController & { setPlayhead: (value: number) => void } {
  let playhead = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getPlayhead() {
      return playhead;
    },
    setPlayhead(value: number) {
      playhead = value;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

describe("useRuntimeController", () => {
  beforeEach(() => {
    createScrollSection.mockReset();
  });

  it("does not rebuild the controlled runtime when play state changes", () => {
    const controller = {
      destroy: vi.fn(),
      refresh: vi.fn(),
      setProgress: vi.fn(),
      setTargetProgress: vi.fn(),
      setOverlayTransitionsEnabled: vi.fn(),
      updateManifest: vi.fn(),
      getProgress: vi.fn(() => 0.2),
      getTargetProgress: vi.fn(() => 0.2),
    };
    createScrollSection.mockReturnValue(controller);

    const mountNodeRef = {
      current: document.createElement("div"),
    };
    const playback = createPlayback(0.2);

    const { rerender } = renderHook(
      ({ isPlaying }) =>
        useRuntimeController({
          manifest: makeManifest() as never,
          renderManifest: makeManifest() as never,
          restartKey: "stable-runtime",
          mode: "desktop",
          isPlaying,
          isControlledRuntime: true,
          hasRenderableMedia: true,
          playback,
          selectedOverlayId: undefined,
          mountNodeRef,
          onPlayheadChange: undefined,
          onSelectOverlay: undefined,
          scheduleWireInteractivity: vi.fn(),
        }),
      {
        initialProps: { isPlaying: false },
      },
    );

    expect(createScrollSection).toHaveBeenCalledTimes(1);
    expect(controller.updateManifest).toHaveBeenCalled();

    rerender({ isPlaying: true });

    expect(createScrollSection).toHaveBeenCalledTimes(1);
    expect(controller.setOverlayTransitionsEnabled).toHaveBeenCalledWith(false);
    expect(controller.setOverlayTransitionsEnabled).toHaveBeenCalledWith(true);
  });

  it("keeps selection while paused even if the playhead leaves the overlay range", () => {
    const controller = {
      destroy: vi.fn(),
      refresh: vi.fn(),
      setProgress: vi.fn(),
      setTargetProgress: vi.fn(),
      setOverlayTransitionsEnabled: vi.fn(),
      updateManifest: vi.fn(),
      getProgress: vi.fn(() => 0.6),
      getTargetProgress: vi.fn(() => 0.6),
    };
    createScrollSection.mockReturnValue(controller);
    const onSelectOverlay = vi.fn();
    const playback = createPlayback(0.6);

    renderHook(() =>
      useRuntimeController({
        manifest: makeManifest() as never,
        renderManifest: makeManifest() as never,
        restartKey: "stable-runtime",
        mode: "desktop",
        isPlaying: false,
        isControlledRuntime: true,
        hasRenderableMedia: true,
        playback,
        selectedOverlayId: "overlay-1",
        mountNodeRef: { current: document.createElement("div") },
        onPlayheadChange: undefined,
        onSelectOverlay,
        scheduleWireInteractivity: vi.fn(),
      }),
    );

    expect(onSelectOverlay).not.toHaveBeenCalled();
  });

  it("auto-deselects during playback when the playhead leaves the overlay range", () => {
    const controller = {
      destroy: vi.fn(),
      refresh: vi.fn(),
      setProgress: vi.fn(),
      setTargetProgress: vi.fn(),
      setOverlayTransitionsEnabled: vi.fn(),
      updateManifest: vi.fn(),
      getProgress: vi.fn(() => 0.6),
      getTargetProgress: vi.fn(() => 0.6),
    };
    createScrollSection.mockReturnValue(controller);
    const onSelectOverlay = vi.fn();
    const playback = createPlayback(0.6);

    renderHook(() =>
      useRuntimeController({
        manifest: makeManifest() as never,
        renderManifest: makeManifest() as never,
        restartKey: "stable-runtime",
        mode: "desktop",
        isPlaying: true,
        isControlledRuntime: true,
        hasRenderableMedia: true,
        playback,
        selectedOverlayId: "overlay-1",
        mountNodeRef: { current: document.createElement("div") },
        onPlayheadChange: undefined,
        onSelectOverlay,
        scheduleWireInteractivity: vi.fn(),
      }),
    );

    expect(onSelectOverlay).toHaveBeenCalledWith("");
  });

  it("updates the controlled runtime manifest in place without rebuilding", () => {
    const controller = {
      destroy: vi.fn(),
      refresh: vi.fn(),
      setProgress: vi.fn(),
      setTargetProgress: vi.fn(),
      setOverlayTransitionsEnabled: vi.fn(),
      updateManifest: vi.fn(),
      getProgress: vi.fn(() => 0.2),
      getTargetProgress: vi.fn(() => 0.2),
    };
    createScrollSection.mockReturnValue(controller);
    const mountNodeRef = { current: document.createElement("div") };
    const playback = createPlayback(0.2);
    const manifestA = makeManifest() as never;
    const manifestB = {
      sections: [
        {
          overlays: [
            {
              id: "overlay-1",
              timing: { start: 0.25, end: 0.55 },
            },
          ],
        },
      ],
    } as const as never;

    const { rerender } = renderHook(
      ({ renderManifest }) =>
        useRuntimeController({
          manifest: renderManifest,
          renderManifest,
          restartKey: "stable-runtime",
          mode: "desktop",
          isPlaying: false,
          isControlledRuntime: true,
          hasRenderableMedia: true,
          playback,
          selectedOverlayId: undefined,
          mountNodeRef,
          onPlayheadChange: undefined,
          onSelectOverlay: undefined,
          scheduleWireInteractivity: vi.fn(),
        }),
      {
        initialProps: { renderManifest: manifestA },
      },
    );

    createScrollSection.mockClear();
    controller.updateManifest.mockClear();

    rerender({ renderManifest: manifestB });

    expect(createScrollSection).not.toHaveBeenCalled();
    expect(controller.updateManifest).toHaveBeenCalledWith(manifestB);
  });
});
