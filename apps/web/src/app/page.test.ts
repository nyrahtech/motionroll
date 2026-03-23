import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePageAuth = vi.fn();
const getEditorHomeProjectForUser = vi.fn();
const redirect = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("@/lib/auth", () => ({
  requirePageAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  getEditorHomeProjectForUser,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.resetModules();
    requirePageAuth.mockReset();
    getEditorHomeProjectForUser.mockReset();
    redirect.mockClear();

    requirePageAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("redirects to the editor home project when one is available", async () => {
    getEditorHomeProjectForUser.mockResolvedValueOnce({ id: "project_123" });

    const HomePage = (await import("./page")).default;

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/projects/project_123");
  });

  it("redirects to the library with a degraded notice when the workspace lookup is retryable", async () => {
    getEditorHomeProjectForUser.mockRejectedValueOnce(
      new Error("Failed query: select * from projects\ncause: connect ECONNREFUSED 127.0.0.1:5432"),
    );

    const HomePage = (await import("./page")).default;

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/library?workspace=home_unavailable");
  });

  it("redirects to the library when no home project is available", async () => {
    getEditorHomeProjectForUser.mockResolvedValueOnce(null);

    const HomePage = (await import("./page")).default;

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/library");
  });
});
