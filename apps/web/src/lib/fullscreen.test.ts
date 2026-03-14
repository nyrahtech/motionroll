import { describe, expect, it, vi } from "vitest";
import {
  canUseFullscreenApi,
  exitFullscreenIfActive,
  isFullscreenElementActive,
  requestFullscreenForElement,
} from "./fullscreen";

describe("fullscreen helpers", () => {
  it("detects fullscreen availability from the document", () => {
    expect(canUseFullscreenApi({ fullscreenEnabled: true })).toBe(true);
    expect(canUseFullscreenApi({ fullscreenEnabled: false })).toBe(false);
    expect(canUseFullscreenApi(undefined)).toBe(false);
  });

  it("requests fullscreen when the element supports it", async () => {
    const requestFullscreen = vi.fn();
    await expect(requestFullscreenForElement({ requestFullscreen })).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("exits fullscreen only when an element is active", async () => {
    const exitFullscreen = vi.fn();
    await expect(
      exitFullscreenIfActive({
        fullscreenElement: {} as Element,
        exitFullscreen,
      }),
    ).resolves.toBe(true);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    await expect(exitFullscreenIfActive({ exitFullscreen })).resolves.toBe(false);
  });

  it("matches the current fullscreen element safely", () => {
    const element = {} as Element;
    expect(
      isFullscreenElementActive({ fullscreenElement: element }, element),
    ).toBe(true);
    expect(
      isFullscreenElementActive({ fullscreenElement: null }, element),
    ).toBe(false);
  });
});
