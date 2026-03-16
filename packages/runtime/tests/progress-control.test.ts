import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectManifest } from "../../shared/src";

class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  href = "";
  rel = "";
  alt = "";
  src = "";
  autoplay = false;
  loop = false;
  muted = false;
  playsInline = false;
  ariaHidden = "false";
  clientWidth = 960;
  clientHeight = 540;
  rectTop = 0;
  rectHeight = 540;
  parent: FakeElement | null = null;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  appendChild(child: FakeElement) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parent) {
      return undefined;
    }

    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
    return undefined;
  }

  replaceChildren(...children: FakeElement[]) {
    this.children = [];
    children.forEach((child) => this.appendChild(child));
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string) {
    const results: FakeElement[] = [];
    const visit = (node: FakeElement) => {
      if (matchesSelector(node, selector)) {
        results.push(node);
      }
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return results;
  }

  getBoundingClientRect() {
    return {
      width: this.clientWidth,
      height: this.rectHeight,
      top: this.rectTop,
      left: 0,
      right: this.clientWidth,
      bottom: this.rectTop + this.rectHeight,
    };
  }
}

function matchesSelector(node: FakeElement, selector: string) {
  if (selector === "a") {
    return node.tagName === "a";
  }

  const dataMatch = selector.match(/^\[data-([a-z-]+)=["']([^"']+)["']\]$/);
  if (dataMatch) {
    const dataKey = dataMatch[1]!.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    return node.dataset[dataKey] === dataMatch[2];
  }

  return false;
}

class FakeCanvasContext {
  drawImage = vi.fn();
  clearRect = vi.fn();
  fillRect = vi.fn();
  setTransform = vi.fn();
  fillStyle = "#000";
}

class FakeCanvasElement extends FakeElement {
  width = 960;
  height = 540;
  context = new FakeCanvasContext();

  constructor() {
    super("canvas");
  }

  getContext() {
    return this.context;
  }
}

class FakeImage {
  decoding = "async";
  naturalWidth = 1920;
  naturalHeight = 1080;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #src = "";

  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => {
      this.onload?.();
    });
  }

  get src() {
    return this.#src;
  }
}

function createManifest(): ProjectManifest {
  return {
    version: "1.0.0",
    generatedAt: new Date(0).toISOString(),
    selectedPreset: "product-reveal" as const,
    project: {
      id: "11111111-1111-1111-1111-111111111111",
      slug: "demo",
      title: "Demo",
      ownerId: "local",
      publishVersion: 1,
      previewUrl: "/preview/demo",
    },
    publishTarget: {
      slug: "demo",
      targetType: "hosted_embed" as const,
      version: 1,
      previewUrl: "/preview/demo",
      isReady: true,
    },
    sections: [
      {
        id: "22222222-2222-2222-2222-222222222222",
        presetId: "product-reveal" as const,
        title: "Section",
        frameAssets: [
          { index: 0, path: "frame-0", variants: [{ kind: "mobile" as const, url: "/frames/0-mobile.jpg" }] },
          { index: 1, path: "frame-1", variants: [{ kind: "mobile" as const, url: "/frames/1-mobile.jpg" }] },
          { index: 2, path: "frame-2", variants: [{ kind: "mobile" as const, url: "/frames/2-mobile.jpg" }] },
        ],
        frameCount: 3,
        progressMapping: {
          startProgress: 0,
          endProgress: 1,
          frameCount: 3,
          frameRange: {
            start: 0,
            end: 2,
          },
        },
        overlays: [
          {
            id: "overlay-1",
            timing: { start: 0.05, end: 0.45 },
            content: {
              headline: "First beat",
              body: "Start here",
              align: "start" as const,
              theme: "light" as const,
              treatment: "default" as const,
              layer: 0,
            },
          },
          {
            id: "overlay-2",
            timing: { start: 0.5, end: 0.9 },
            content: {
              headline: "Second beat",
              body: "Move here",
              align: "end" as const,
              theme: "dark" as const,
              treatment: "default" as const,
              layer: 1,
            },
          },
        ],
        moments: [],
        transitions: [],
        fallback: {
          posterUrl: "/poster.png",
          fallbackVideoUrl: "/fallback.mp4",
          firstFrameUrl: "/first-frame.png",
          mobileBehavior: "video" as const,
          reducedMotionBehavior: "poster" as const,
        },
        motion: {
          sectionHeightVh: 220,
          scrubStrength: 1,
          easing: "linear" as const,
          pin: true,
          preloadWindow: 2,
        },
        presetConfig: {},
        runtimeProfile: {
          presetId: "product-reveal" as const,
          kind: "product-reveal" as const,
          sequenceStrategy: "spotlight" as const,
          chromeLabel: "Preview",
          previewDescription: "Demo",
          overlayEntrance: "fade-up" as const,
          highlightMetricLabel: "Spotlight",
        },
      },
    ],
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

let windowListeners: Record<string, Array<() => void>> = {};

describe("runtime controlled progress", () => {
  beforeEach(() => {
    vi.resetModules();
    windowListeners = {};
    vi.stubGlobal("document", {
      createElement: (tagName: string) =>
        tagName === "canvas" ? new FakeCanvasElement() : new FakeElement(tagName),
    });
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      innerHeight: 1000,
      addEventListener: (eventName: string, callback: () => void) => {
        windowListeners[eventName] ??= [];
        windowListeners[eventName].push(callback);
      },
      removeEventListener: (eventName: string, callback: () => void) => {
        windowListeners[eventName] = (windowListeners[eventName] ?? []).filter(
          (listener) => listener !== callback,
        );
      },
    });
    vi.stubGlobal("Image", FakeImage);
  });

  it("exposes setProgress/getProgress for preview scrubbing", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const manifest = createManifest();
    const section = manifest.sections[0]!;

    const controller = createScrollSection(
      container,
      {
        ...manifest,
        sections: [
          {
            ...section,
            frameAssets: [],
            frameCount: 0,
            progressMapping: {
              startProgress: 0,
              endProgress: 1,
              frameCount: 1,
              frameRange: {
                start: 0,
                end: 1,
              },
            },
          },
        ],
      },
      {
        mode: "desktop",
        reducedMotion: false,
        overlayRoot,
      },
    );

    expect(controller.getProgress()).toBe(0);

    controller.setProgress(0.2);
    expect(controller.getProgress()).toBe(0.2);
    expect((overlayRoot as unknown as FakeElement).dataset.activeOverlayId).toBe("overlay-1");

    controller.setProgress(0.55);
    expect(controller.getProgress()).toBe(0.55);
    expect((overlayRoot as unknown as FakeElement).dataset.activeOverlayId).toBe("overlay-2");
  });

  it("forces sequence rendering in controlled mobile mode when frames exist", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const canvas = new FakeCanvasElement() as unknown as HTMLCanvasElement;

    const controller = createScrollSection(container, createManifest(), {
      mode: "mobile",
      interactionMode: "controlled",
      reducedMotion: true,
      overlayRoot,
      canvas,
    });

    controller.setProgress(0.6);
    expect((overlayRoot as unknown as FakeElement).dataset.activeOverlayId).toBe("overlay-2");

    await flushPromises();

    const drawCalls = ((canvas as unknown as FakeCanvasElement).context.drawImage as ReturnType<typeof vi.fn>).mock.calls;
    expect(drawCalls.length).toBeGreaterThan(0);
    expect((container as unknown as FakeElement).children.some((child) => child.tagName === "video")).toBe(false);
  });

  it("seeds the controlled placeholder from the current playhead frame", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const canvas = new FakeCanvasElement() as unknown as HTMLCanvasElement;

    createScrollSection(container, createManifest(), {
      mode: "mobile",
      interactionMode: "controlled",
      overlayRoot,
      canvas,
      initialProgress: 1,
    });

    const poster = (container as unknown as FakeElement).children.find(
      (child) => child.tagName === "img",
    );

    expect(poster?.src).toBe("/frames/2-mobile.jpg");
  });

  it("uses sequence rendering in scroll mobile mode when frames exist", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const canvas = new FakeCanvasElement() as unknown as HTMLCanvasElement;

    createScrollSection(container, createManifest(), {
      mode: "mobile",
      interactionMode: "scroll",
      reducedMotion: false,
      overlayRoot,
      canvas,
    });

    await flushPromises();

    const drawCalls = ((canvas as unknown as FakeCanvasElement).context.drawImage as ReturnType<typeof vi.fn>).mock.calls;
    expect(drawCalls.length).toBeGreaterThan(0);
    expect((container as unknown as FakeElement).children.some((child) => child.tagName === "video")).toBe(false);
  });

  it("maps the bottom of a scroll section to full progress", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div");
    container.rectHeight = 3000;

    const controller = createScrollSection(
      container as unknown as HTMLElement,
      createManifest(),
      {
        mode: "desktop",
        interactionMode: "scroll",
        reducedMotion: false,
      },
    );

    container.rectTop = -2000;
    windowListeners.scroll?.forEach((listener) => listener());

    expect(controller.getTargetProgress()).toBe(1);
  });
});
