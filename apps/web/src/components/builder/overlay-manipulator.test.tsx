import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
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
    host.remove();
    vi.unstubAllGlobals();
  });

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
});
