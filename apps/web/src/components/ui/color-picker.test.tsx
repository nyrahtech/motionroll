import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColorPicker } from "./color-picker";

describe("ColorPicker", () => {
  let rafQueue: Array<FrameRequestCallback>;
  let eyeDropperOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rafQueue = [];
    eyeDropperOpen = vi.fn();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => {
      const index = id - 1;
      if (index >= 0 && index < rafQueue.length) {
        rafQueue[index] = () => undefined;
      }
    }));
    vi.stubGlobal("EyeDropper", class {
      open = eyeDropperOpen;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function flushAnimationFrame(time = 16) {
    const queue = [...rafQueue];
    rafQueue = [];
    for (const callback of queue) {
      callback(time);
    }
  }

  function mockHorizontalTrack(node: HTMLElement, width = 100) {
    node.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width,
        height: 12,
        right: width,
        bottom: 12,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }

  it("coalesces hue drag updates to one animation frame and commits the latest value", async () => {
    const onLiveChange = vi.fn();
    const onCommitChange = vi.fn();

    render(
      <ColorPicker
        label="Text color"
        value="#ff0000"
        onLiveChange={onLiveChange}
        onCommitChange={onCommitChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Text color" }));

    const hueSlider = await screen.findByRole("slider", { name: "Text color hue" });
    mockHorizontalTrack(hueSlider);

    fireEvent.pointerDown(hueSlider, { clientX: 33, pointerId: 1 });
    fireEvent.pointerMove(hueSlider, { clientX: 50, buttons: 1, pointerId: 1 });

    expect(onLiveChange).not.toHaveBeenCalled();

    flushAnimationFrame();

    expect(onLiveChange).toHaveBeenCalledTimes(1);
    expect(onLiveChange).toHaveBeenLastCalledWith("#00ffff");

    fireEvent.pointerUp(hueSlider, { clientX: 50, pointerId: 1 });

    expect(onCommitChange).toHaveBeenCalledWith("#00ffff");
  });

  it("keeps the hue thumb at the far right when the committed color stays on the red boundary", async () => {
    function ControlledPicker() {
      const [value, setValue] = React.useState("#ff0000");
      return (
        <ColorPicker
          label="Boundary color"
          value={value}
          onCommitChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<ControlledPicker />);

    fireEvent.click(screen.getByRole("button", { name: "Boundary color" }));

    const hueSlider = await screen.findByRole("slider", { name: "Boundary color hue" });
    mockHorizontalTrack(hueSlider);

    fireEvent.pointerDown(hueSlider, { clientX: 100, pointerId: 1 });
    flushAnimationFrame();
    fireEvent.pointerUp(hueSlider, { clientX: 100, pointerId: 1 });

    const thumb = Array.from(hueSlider.querySelectorAll("span")).find((node) =>
      node.getAttribute("style")?.includes("left: 100%"),
    );
    expect(thumb?.getAttribute("style")).toContain("left: 100%");
  });

  it("renders opacity as a scrubber with a percentage chip and removes the old number field", async () => {
    const onOpacityChange = vi.fn();

    render(
      <ColorPicker
        label="Text color"
        value="#ff0000"
        opacity={0.45}
        onOpacityChange={onOpacityChange}
        onCommitChange={() => undefined}
      />,
    );

    const triggers = screen.getAllByRole("button", { name: "Text color" });
    fireEvent.click(triggers[triggers.length - 1]!);

    const opacitySlider = await screen.findByRole("slider", { name: "Text color opacity" });
    mockHorizontalTrack(opacitySlider);

    expect(screen.getByText("45%")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();

    fireEvent.pointerDown(opacitySlider, { clientX: 72, pointerId: 1 });
    flushAnimationFrame();

    expect(onOpacityChange).toHaveBeenCalledWith(0.72);
  });

  it("routes the native browser color input through the same live and commit flow", async () => {
    const onLiveChange = vi.fn();
    const onCommitChange = vi.fn();
    eyeDropperOpen.mockResolvedValue({ sRGBHex: "#123456" });

    render(
      <ColorPicker
        label="Text color"
        value="#ff0000"
        onLiveChange={onLiveChange}
        onCommitChange={onCommitChange}
      />,
    );

    const triggers = screen.getAllByRole("button", { name: "Text color" });
    fireEvent.click(triggers[triggers.length - 1]!);

    fireEvent.click(await screen.findByRole("button", { name: "Text color screen color picker" }));

    flushAnimationFrame();

    expect(eyeDropperOpen).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onLiveChange).toHaveBeenCalledWith("#123456");
      expect(onCommitChange).toHaveBeenCalledWith("#123456");
    });
  });

  it("marks selection-safe popovers as overlay selection chrome", async () => {
    render(
      <ColorPicker
        label="Quick color"
        value="#ff0000"
        selectionChrome
        onCommitChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quick color" }));

    const hueSlider = await screen.findByRole("slider", { name: "Quick color hue" });
    expect(hueSlider.closest("[data-overlay-selection-chrome]")).toBeTruthy();
  });
});
