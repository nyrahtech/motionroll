import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePageAuth = vi.fn();
const createProjectFromPreset = vi.fn();
const redirect = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("@/lib/auth", () => ({
  requirePageAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  createProjectFromPreset,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

describe("createProjectAction", () => {
  beforeEach(() => {
    vi.resetModules();
    requirePageAuth.mockReset();
    createProjectFromPreset.mockReset();
    redirect.mockClear();

    requirePageAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("redirects to the created project on success", async () => {
    createProjectFromPreset.mockResolvedValueOnce({ id: "project_123" });

    const { createProjectAction } = await import("./actions");
    const formData = new FormData();
    formData.set("presetId", "product-reveal");

    await expect(createProjectAction(formData)).rejects.toThrow("NEXT_REDIRECT:/projects/project_123");
    expect(createProjectFromPreset).toHaveBeenCalledWith("user_test_123", "product-reveal", undefined);
  });

  it("redirects back to the library with a degraded notice when creation hits a retryable backend failure", async () => {
    createProjectFromPreset.mockRejectedValueOnce(
      new Error("Failed query: insert into projects\ncause: connect ECONNREFUSED 127.0.0.1:5432"),
    );

    const { createProjectAction } = await import("./actions");
    const formData = new FormData();
    formData.set("presetId", "product-reveal");

    await expect(createProjectAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/library?workspace=create_failed",
    );
  });
});
