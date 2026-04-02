import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverlayManipulator } from "./overlay-manipulator";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function makeOverlay() {
  return {
    id: "overlay-1",
    timing: { start: 0.1, end: 0.4 },
    timingSource: "manual",
    content: {
      type: "text",
      text: "Hello world",
      align: "start",
      theme: "dark",
      treatment: "default",
      blendMode: "normal",
      enterAnimation: { type: "fade", easing: "ease-out", duration: 0.45, delay: 0 },
      exitAnimation: { type: "none", easing: "ease-in-out", duration: 0.35 },
      layout: { x: 0.1, y: 0.2, width: 320, height: 120 },
      style: {
        fontFamily: "Inter",
        fontWeight: 600,
        fontSize: 34,
        color: "#f6f7fb",
        lineHeight: 1.08,
        letterSpacing: 0,
        opacity: 1,
        maxWidth: 420,
        textAlign: "start",
        italic: false,
        underline: false,
        textTransform: "none",
        buttonLike: false,
      },
      background: {
        enabled: false,
        mode: "transparent",
        color: "#0d1016",
        opacity: 0.82,
        radius: 14,
        paddingX: 18,
        paddingY: 14,
        borderColor: "#d6f6ff",
        borderOpacity: 0,
      },
    },
  } as const;
}

describe("OverlayManipulator", () => {
  let host: HTMLDivElement;
  let rafQueue: Array<FrameRequestCallback>;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    rafQueue = [];
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
    host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 1280 });
    Object.defineProperty(host, "clientHeight", { configurable: true, value: 720 });
    host.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
        right: 1280,
        bottom: 720,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(host);
  });

  afterEach(() => {
    cleanup();
    host.remove();
    vi.unstubAllGlobals();
  });

  function flushAnimationFrame(time = 16) {
    const queue = [...rafQueue];
    rafQueue = [];
    for (const callback of queue) {
      callback(time);
    }
  }

  it("does not render selection chrome for inactive hidden overlays", async () => {
    const card = document.createElement("article");
    card.dataset.overlayId = "overlay-1";
    card.dataset.state = "inactive";
    card.setAttribute("aria-hidden", "true");
    card.style.visibility = "hidden";
    card.getBoundingClientRect = () =>
      ({
        left: 120,
        top: 100,
        width: 320,
        height: 120,
        right: 440,
        bottom: 220,
        x: 120,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    host.appendChild(card);

    render(
      <OverlayManipulator
        overlay={makeOverlay()}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Drag overlay" })).toBeNull();
    });
  });

  it("renders selection chrome for active overlays", async () => {
    const card = document.createElement("article");
    card.dataset.overlayId = "overlay-1";
    card.dataset.state = "active";
    card.setAttribute("aria-hidden", "false");
    card.style.visibility = "visible";
    card.getBoundingClientRect = () =>
      ({
        left: 120,
        top: 100,
        width: 320,
        height: 120,
        right: 440,
        bottom: 220,
        x: 120,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    host.appendChild(card);

    render(
      <OverlayManipulator
        overlay={makeOverlay()}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Drag overlay" })).toBeTruthy();
    });
  });

  it("renders visible resize handles for active overlays", async () => {
    const card = document.createElement("article");
    card.dataset.overlayId = "overlay-1";
    card.dataset.state = "active";
    card.setAttribute("aria-hidden", "false");
    card.style.visibility = "visible";
    card.getBoundingClientRect = () =>
      ({
        left: 120,
        top: 100,
        width: 320,
        height: 120,
        right: 440,
        bottom: 220,
        x: 120,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    host.appendChild(card);

    render(
      <OverlayManipulator
        overlay={makeOverlay()}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
      />,
    );

    const resizeHandles = await screen.findAllByRole("button", { name: "Resize overlay north west" });
    expect(resizeHandles.some((handle) => handle.className.includes("border-2"))).toBe(true);
    expect(resizeHandles.some((handle) => handle.className.includes("bg-[#0a1520]"))).toBe(true);
  });

  it("shows selection chrome immediately from overlay layout before RAF measurement", () => {
    render(
      <OverlayManipulator
        overlay={makeOverlay()}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
      />,
    );

    expect(screen.getAllByRole("button", { name: "Drag overlay" }).length).toBeGreaterThan(0);
  });

  it("does not replace the current chrome box with fallback layout when the same overlay stays selected", async () => {
    const card = document.createElement("article");
    card.dataset.overlayId = "overlay-1";
    card.dataset.state = "active";
    card.setAttribute("aria-hidden", "false");
    card.style.visibility = "visible";
    card.getBoundingClientRect = () =>
      ({
        left: 120,
        top: 100,
        width: 320,
        height: 120,
        right: 440,
        bottom: 220,
        x: 120,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    host.appendChild(card);

    const { rerender } = render(
      <OverlayManipulator
        overlay={makeOverlay()}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Drag overlay" }).length).toBeGreaterThan(0);
    });

    const updatedOverlay = {
      ...makeOverlay(),
      content: {
        ...makeOverlay().content,
        layout: { x: 0.45, y: 0.5, width: 180, height: 72 },
      },
    };

    rerender(
      <OverlayManipulator
        overlay={updatedOverlay}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
      />,
    );

    const dragButtons = screen.getAllByRole("button", { name: "Drag overlay" });
    expect(dragButtons.some((button) => button.getAttribute("style")?.includes("left: 400px"))).toBe(true);
  });

  it("keeps the current chrome position during same-selection save churn and updates only after the DOM moves", async () => {
    const card = document.createElement("article");
    card.dataset.overlayId = "overlay-1";
    card.dataset.state = "active";
    card.setAttribute("aria-hidden", "false");
    card.style.visibility = "visible";

    let rect = {
      left: 120,
      top: 100,
      width: 320,
      height: 120,
      right: 440,
      bottom: 220,
      x: 120,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;

    card.getBoundingClientRect = () => rect;
    host.appendChild(card);

    const { rerender } = render(
      <OverlayManipulator
        overlay={makeOverlay()}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Drag overlay" }).length).toBeGreaterThan(0);
    });

    const updatedOverlay = {
      ...makeOverlay(),
      content: {
        ...makeOverlay().content,
        layout: { x: 0.45, y: 0.5, width: 180, height: 72 },
      },
    };

    rerender(
      <OverlayManipulator
        overlay={updatedOverlay}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
      />,
    );

    let dragButtons = screen.getAllByRole("button", { name: "Drag overlay" });
    expect(dragButtons.some((button) => button.getAttribute("style")?.includes("left: 400px"))).toBe(true);

    rect = {
      left: 640,
      top: 260,
      width: 180,
      height: 72,
      right: 820,
      bottom: 332,
      x: 640,
      y: 260,
      toJSON: () => ({}),
    } as DOMRect;
    card.style.left = "640px";
    fireEvent(window, new Event("resize"));
    flushAnimationFrame();

    await waitFor(() => {
      dragButtons = screen.getAllByRole("button", { name: "Drag overlay" });
      expect(dragButtons.some((button) => button.getAttribute("style")?.includes("left: 780px"))).toBe(true);
    });
  });

  it("keeps the overlay selected while live color dragging from the quick toolbar", async () => {
    const card = document.createElement("article");
    card.dataset.overlayId = "overlay-1";
    card.dataset.state = "active";
    card.setAttribute("aria-hidden", "false");
    card.style.visibility = "visible";
    card.getBoundingClientRect = () =>
      ({
        left: 120,
        top: 100,
        width: 320,
        height: 120,
        right: 440,
        bottom: 220,
        x: 120,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    host.appendChild(card);

    const onStyleLiveChange = vi.fn();
    const onStyleChange = vi.fn();

    render(
      <OverlayManipulator
        overlay={makeOverlay()}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
        onStyleLiveChange={onStyleLiveChange}
        onStyleChange={onStyleChange}
      />,
    );

    const colorTriggers = screen.getAllByRole("button", { name: "Text color" });
    fireEvent.click(colorTriggers[colorTriggers.length - 1]!);

    const hueSlider = await screen.findByRole("slider", { name: "Text color hue" });
    hueSlider.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 12,
        right: 100,
        bottom: 12,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.pointerDown(hueSlider, { clientX: 33, pointerId: 1 });
    fireEvent.pointerMove(hueSlider, { clientX: 50, buttons: 1, pointerId: 1 });

    flushAnimationFrame();

    expect(onStyleLiveChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Drag overlay" })).toBeTruthy();

    fireEvent.pointerUp(hueSlider, { clientX: 50, pointerId: 1 });

    expect(onStyleChange).toHaveBeenCalledWith(
      expect.objectContaining({ color: expect.any(String) }),
    );
    expect(screen.getByRole("button", { name: "Drag overlay" })).toBeTruthy();
  });

  it("commits drag moves without shrinking overlay width or height", async () => {
    const card = document.createElement("article");
    card.dataset.overlayId = "overlay-1";
    card.dataset.state = "active";
    card.setAttribute("aria-hidden", "false");
    card.style.visibility = "visible";
    card.getBoundingClientRect = () =>
      ({
        left: 120,
        top: 100,
        width: 320,
        height: 120,
        right: 440,
        bottom: 220,
        x: 120,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    host.appendChild(card);

    const onLayoutChange = vi.fn();

    render(
      <OverlayManipulator
        overlay={makeOverlay()}
        selectedOverlayId="overlay-1"
        containerRef={{ current: host }}
        isTextStyle
        onLayoutChange={onLayoutChange}
      />,
    );

    const dragHandle = await screen.findByRole("button", { name: "Drag overlay" });
    fireEvent.pointerDown(dragHandle, { clientX: 220, clientY: 140, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 280, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onLayoutChange).toHaveBeenCalledWith(
      expect.objectContaining({
        x: expect.closeTo(180 / 1280, 4),
        y: expect.closeTo(140 / 720, 4),
      }),
      expect.objectContaining({ intent: "move" }),
    );
    const nextLayout = onLayoutChange.mock.calls[0]?.[0];
    expect(nextLayout).not.toHaveProperty("width");
    expect(nextLayout).not.toHaveProperty("height");
  });
});
