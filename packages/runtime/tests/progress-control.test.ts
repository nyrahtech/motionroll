import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  href = "";
  rel = "";
  clientWidth = 960;
  clientHeight = 540;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }

  remove() {
    return undefined;
  }

  replaceChildren(...children: FakeElement[]) {
    this.children = children;
  }
}

describe("runtime controlled progress", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("document", {
      createElement: (tagName: string) => new FakeElement(tagName),
    });
  });

  it("exposes setProgress/getProgress for preview scrubbing", async () => {
    const { createScrollSection } = await import("../src");
    const container = new FakeElement("div") as unknown as HTMLElement;
    const overlayRoot = new FakeElement("div") as unknown as HTMLElement;

    const controller = createScrollSection(
      container,
      {
        version: "1.0.0",
        generatedAt: new Date(0).toISOString(),
        selectedPreset: "product-reveal",
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
          targetType: "hosted_embed",
          version: 1,
          previewUrl: "/preview/demo",
          isReady: true,
        },
        sections: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            presetId: "product-reveal",
            title: "Section",
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
            overlays: [
              {
                id: "overlay-1",
                timing: { start: 0.05, end: 0.25 },
                content: {
                  headline: "First beat",
                  body: "Start here",
                  align: "start",
                  theme: "light",
                  treatment: "default",
                },
              },
              {
                id: "overlay-2",
                timing: { start: 0.45, end: 0.7 },
                content: {
                  headline: "Second beat",
                  body: "Move here",
                  align: "end",
                  theme: "dark",
                  treatment: "default",
                },
              },
            ],
            fallback: {
              posterUrl: "/poster.png",
              mobileBehavior: "poster",
              reducedMotionBehavior: "poster",
            },
            motion: {
              sectionHeightVh: 220,
              scrubStrength: 1,
              easing: "linear",
              pin: true,
              preloadWindow: 4,
            },
            presetConfig: {},
            runtimeProfile: {
              presetId: "product-reveal",
              kind: "product-reveal",
              sequenceStrategy: "spotlight",
              chromeLabel: "Preview",
              previewDescription: "Demo",
              overlayEntrance: "fade-up",
              highlightMetricLabel: "Spotlight",
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
});
