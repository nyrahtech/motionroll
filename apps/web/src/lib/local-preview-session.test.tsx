import type { ProjectManifest } from "@motionroll/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalPreviewSession,
  purgeExpiredLocalPreviewSessions,
  readLocalPreviewSession,
} from "./local-preview-session";

function makeManifest(title = "Preview Draft") {
  return {
    version: "1.0.0",
    project: { title },
    publishTarget: {
      slug: "preview",
      targetType: "hosted_embed",
      version: 1,
      previewUrl: "/projects/project-1/preview",
      isReady: true,
    },
    selectedPreset: "product-reveal",
    generatedAt: "2026-03-26T12:00:00.000Z",
    sections: [
      {
        id: "8c2c6090-5a11-4868-8ad8-35d950f95ad1",
        presetId: "product-reveal",
        title,
        overlays: [],
        frameAssets: [],
        fallback: {
          posterUrl: "",
          fallbackVideoUrl: "",
          firstFrameUrl: "",
          mobileBehavior: "sequence",
          reducedMotionBehavior: "poster",
        },
        motion: {
          sectionHeightVh: 240,
          scrubStrength: 1,
          easing: "power2.out",
          pin: true,
          preloadWindow: 6,
        },
        progressMapping: {
          startProgress: 0,
          endProgress: 1,
          frameCount: 180,
          frameRange: {
            start: 0,
            end: 180,
          },
        },
        moments: [],
        transitions: [],
        frameCount: 180,
        presetConfig: {},
        runtimeProfile: {
          motionTreatment: "cinematic",
          overlayDensity: "balanced",
          cameraEnergy: "smooth",
        },
      },
    ],
  } as unknown as ProjectManifest;
}

describe("local preview session", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
        key: (index: number) => Array.from(storage.keys())[index] ?? null,
        get length() {
          return storage.size;
        },
      },
    });
    vi.useFakeTimers();
  });

  it("round-trips a local preview session for the same project", () => {
    const manifest = makeManifest("Unsynced draft");
    const sessionId = createLocalPreviewSession("project-1", manifest);

    expect(sessionId).toBeTruthy();
    expect(readLocalPreviewSession("project-1", sessionId)).toEqual(manifest);
  });

  it("rejects sessions for the wrong project", () => {
    const sessionId = createLocalPreviewSession("project-1", makeManifest());

    expect(readLocalPreviewSession("project-2", sessionId)).toBeNull();
  });

  it("purges expired preview sessions", () => {
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));
    const sessionId = createLocalPreviewSession("project-1", makeManifest());

    vi.setSystemTime(new Date("2026-03-26T12:31:00.000Z"));
    purgeExpiredLocalPreviewSessions();

    expect(readLocalPreviewSession("project-1", sessionId)).toBeNull();
  });
});
