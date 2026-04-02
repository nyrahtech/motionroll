import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("next/navigation", () => ({
  redirect,
}));

describe("LegacyLibraryRedirectPage", () => {
  beforeEach(() => {
    vi.resetModules();
    redirect.mockClear();
  });

  it("redirects the legacy templates route to the library", async () => {
    const Page = (await import("./page")).default;

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/library");
  });
});
