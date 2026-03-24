import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectManifest } from "../../shared/src";
import { frameIndexToSequenceProgress } from "../../shared/src";

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
  poster = "";
  preload = "";
  currentTime = 0;
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
  listeners: Record<string, Array<() => void>> = {};

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  play = vi.fn(async () => undefined);
  pause = vi.fn(() => undefined);

  addEventListener(eventName: string, listener: () => void) {
    this.listeners[eventName] ??= [];
    this.listeners[eventName].push(listener);
  }

  removeEventListener(eventName: string, listener: () => void) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).filter(
      (registeredListener) => registeredListener !== listener,
    );
  }

  appendChild(child: FakeElement) {
    if (child.parent) {
      child.parent.children = child.parent.children.filter((existingChild) => existingChild !== child);
    }
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

function createManifest(frameBasePath = "/frames"): ProjectManifest {
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
          { index: 0, path: "frame-0", variants: [{ kind: "mobile" as const, url: `${frameBasePath}/0-mobile.jpg` }] },
          { index: 1, path: "frame-1", variants: [{ kind: "mobile" as const, url: `${frameBasePath}/1-mobile.jpg` }] },
          { index: 2, path: "frame-2", variants: [{ kind: "mobile" as const, url: `${frameBasePath}/2-mobile.jpg` }] },
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
            timingSource: "manual",
            content: {
              text: "First beat\n\nStart here",
              align: "start" as const,
              theme: "light" as const,
              treatment: "default" as const,
              layer: 0,
            },
          },
          {
            id: "overlay-2",
            timing: { start: 0.5, end: 0.9 },
            timingSource: "manual",
            content: {
              text: "Second beat\n\nMove here",
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
          posterUrl: `${frameBasePath}/poster.png`,
          fallbackVideoUrl: `${frameBasePath}/fallback.mp4`,
          firstFrameUrl: `${frameBasePath}/first-frame.png`,
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

  it("prefers fallback video in controlled mode when the frame sequence is too sparse for smooth playback", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const canvas = new FakeCanvasElement() as unknown as HTMLCanvasElement;
    const manifest = createManifest();
    const section = manifest.sections[0]!;

    const controller = createScrollSection(container, {
      ...manifest,
      sections: [
        {
          ...section,
          frameAssets: Array.from({ length: 47 }, (_, index) => ({
            index,
            path: `frame-${index}`,
            variants: [{ kind: "mobile" as const, url: `/frames/${index}-mobile.jpg` }],
          })),
          frameCount: 47,
          progressMapping: {
            startProgress: 0,
            endProgress: 1,
            frameCount: 47,
            frameRange: {
              start: 0,
              end: 46,
            },
          },
          motion: {
            ...section.motion,
            durationSeconds: 28.3,
          },
          fallback: {
            ...section.fallback,
            fallbackVideoUrl: "/fallback.mp4",
          },
        },
      ],
    }, {
      mode: "mobile",
      interactionMode: "controlled",
      reducedMotion: false,
      overlayRoot,
      canvas,
    });

    controller.setOverlayTransitionsEnabled(true);
    controller.setProgress(0.5);

    const video = (container as unknown as FakeElement).children.find((child) => child.tagName === "video");
    const drawCalls = ((canvas as unknown as FakeCanvasElement).context.drawImage as ReturnType<typeof vi.fn>).mock.calls;

    expect(video?.src).toBe("/fallback.mp4");
    expect(video?.poster).toBe("/poster.png");
    expect(video?.preload).toBe("auto");
    expect(video?.play).toHaveBeenCalled();
    expect(drawCalls).toHaveLength(0);
  });

  it("renders overlays in layer stack order even when manifest rows are out of order", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const manifest = createManifest();
    const section = manifest.sections[0]!;

    createScrollSection(container, {
      ...manifest,
      sections: [
        {
          ...section,
          overlays: [
            {
              ...section.overlays[1]!,
              id: "overlay-top",
              content: {
                ...section.overlays[1]!.content,
                layer: 2,
              },
            },
            {
              ...section.overlays[0]!,
              id: "overlay-bottom",
              content: {
                ...section.overlays[0]!.content,
                layer: 0,
              },
            },
          ],
        },
      ],
    }, {
      mode: "desktop",
      reducedMotion: false,
      overlayRoot,
    });

    const overlayCards = (overlayRoot as unknown as FakeElement).children;
    expect(overlayCards.map((child) => child.dataset.overlayId)).toEqual(["overlay-bottom", "overlay-top"]);
    expect(overlayCards.map((child) => child.style.zIndex)).toEqual(["100", "102"]);
  });

  it("maps trimmed scene progress locally within the visible sequence range", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const canvas = new FakeCanvasElement() as unknown as HTMLCanvasElement;
    const manifest = createManifest();
    const section = manifest.sections[0]!;

    const controller = createScrollSection(container, {
      ...manifest,
      sections: [
        {
          ...section,
          frameAssets: [
            { index: 10, path: "frame-10", variants: [{ kind: "mobile" as const, url: "/frames/10-mobile.jpg" }] },
            { index: 15, path: "frame-15", variants: [{ kind: "mobile" as const, url: "/frames/15-mobile.jpg" }] },
            { index: 19, path: "frame-19", variants: [{ kind: "mobile" as const, url: "/frames/19-mobile.jpg" }] },
          ],
          frameCount: 20,
          progressMapping: {
            startProgress: 0,
            endProgress: 1,
            frameCount: 20,
            frameRange: {
              start: 10,
              end: 19,
            },
          },
        },
      ],
    }, {
      mode: "mobile",
      interactionMode: "controlled",
      overlayRoot,
      canvas,
      initialProgress: frameIndexToSequenceProgress(10, 20),
    });

    await flushPromises();

    let drawCalls = ((canvas as unknown as FakeCanvasElement).context.drawImage as ReturnType<typeof vi.fn>).mock.calls;
    expect(drawCalls.at(-1)?.[0]?.src).toBe("/frames/10-mobile.jpg");

    controller.setProgress(frameIndexToSequenceProgress(19, 20));
    await flushPromises();

    drawCalls = ((canvas as unknown as FakeCanvasElement).context.drawImage as ReturnType<typeof vi.fn>).mock.calls;
    expect(drawCalls.at(-1)?.[0]?.src).toBe("/frames/19-mobile.jpg");
  });

  it("evaluates overlay animation styles from the current controlled progress", async () => {
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
            frameCount: 48,
            progressMapping: {
              startProgress: 0,
              endProgress: 1,
              frameCount: 48,
              frameRange: {
                start: 0,
                end: 47,
              },
            },
            overlays: [
              {
                ...section.overlays[0]!,
                timing: { start: 0.1, end: 0.9 },
                timingSource: "manual",
                content: {
                  ...section.overlays[0]!.content,
                  enterAnimation: {
                    type: "slide-up-fade",
                    easing: "ease-out",
                    duration: 0.4,
                    delay: 0,
                  },
                  exitAnimation: {
                    type: "fade",
                    easing: "ease-in-out",
                    duration: 0.3,
                  },
                },
              },
            ],
          },
        ],
      },
      {
        mode: "desktop",
        interactionMode: "controlled",
        reducedMotion: false,
        overlayRoot,
      },
    );

    const card = (overlayRoot as unknown as FakeElement).children[0];
    expect(card).toBeDefined();

    controller.setProgress(0.2);
    expect(Number(card!.style.opacity)).toBeGreaterThan(0);

    controller.setProgress(0.5);
    expect(Number(card!.style.opacity)).toBeCloseTo(1, 2);
    expect(card!.style.filter ?? "blur(0px)").toBe("blur(0px)");

    controller.setProgress(0.84);
    expect(Number(card!.style.opacity)).toBeCloseTo(1, 2);
    expect(card!.style.filter ?? "blur(0px)").toBe("blur(0px)");
    expect(card!.style.clipPath ?? "inset(0% 0% 0% 0%)").toBe("inset(0% 0% 0% 0%)");
  });

  it("uses the manifest durationSeconds for enter and exit timing instead of raw frame count", async () => {
    const { getOverlayAnimationState } = await import("../src");
    const manifest = createManifest();
    const section = {
      ...manifest.sections[0]!,
      frameCount: 24,
      progressMapping: {
        startProgress: 0,
        endProgress: 1,
        frameCount: 24,
        frameRange: {
          start: 0,
          end: 23,
        },
      },
      motion: {
        ...manifest.sections[0]!.motion,
        durationSeconds: 3,
      },
      overlays: [
        {
          id: "overlay-duration",
          timing: { start: 0, end: 1 },
          timingSource: "manual" as const,
          content: {
            text: "Duration test",
            align: "start" as const,
            theme: "light" as const,
            treatment: "default" as const,
            layer: 0,
            enterAnimation: {
              type: "fade" as const,
              easing: "ease-out" as const,
              duration: 0.2,
              delay: 0,
            },
            exitAnimation: {
              type: "fade" as const,
              easing: "ease-in-out" as const,
              duration: 0.2,
            },
          },
        },
      ],
    };

    const stateBeforeExit = getOverlayAnimationState(
      section.overlays[0]!,
      section,
      0.5,
    );
    const stateNearEnd = getOverlayAnimationState(
      section.overlays[0]!,
      section,
      0.96,
    );

    expect(stateBeforeExit.opacity).toBeCloseTo(1, 2);
    expect(stateNearEnd.opacity).toBeLessThan(1);
  });

  it("does not redraw the canvas again when controlled playback stays on the same frame", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const canvas = new FakeCanvasElement() as unknown as HTMLCanvasElement;

    const controller = createScrollSection(container, createManifest(), {
      mode: "mobile",
      interactionMode: "controlled",
      reducedMotion: false,
      overlayRoot,
      canvas,
    });

    await flushPromises();

    const drawImage = (canvas as unknown as FakeCanvasElement).context
      .drawImage as ReturnType<typeof vi.fn>;
    drawImage.mockClear();

    controller.setProgress(0.1);
    await flushPromises();

    expect(drawImage).not.toHaveBeenCalled();
  });

  it("invalidates cached sequence frames when the manifest swaps to a new processed source", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;
    const canvas = new FakeCanvasElement() as unknown as HTMLCanvasElement;

    const controller = createScrollSection(container, createManifest("/frames-a"), {
      mode: "mobile",
      interactionMode: "controlled",
      reducedMotion: false,
      overlayRoot,
      canvas,
    });

    await flushPromises();

    let drawCalls = ((canvas as unknown as FakeCanvasElement).context.drawImage as ReturnType<typeof vi.fn>).mock.calls;
    expect(drawCalls.at(-1)?.[0]?.src).toBe("/frames-a/0-mobile.jpg");

    controller.updateManifest(createManifest("/frames-b"));
    await flushPromises();

    drawCalls = ((canvas as unknown as FakeCanvasElement).context.drawImage as ReturnType<typeof vi.fn>).mock.calls;
    expect(drawCalls.at(-1)?.[0]?.src).toBe("/frames-b/0-mobile.jpg");
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
