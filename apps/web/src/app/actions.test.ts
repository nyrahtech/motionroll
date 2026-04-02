import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePageAuth = vi.fn();
const createProjectFromSource = vi.fn();
const redirect = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock("@/lib/auth", () => ({
  requirePageAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  createProjectFromSource,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

describe("createProjectAction", () => {
  beforeEach(() => {
    vi.resetModules();
    requirePageAuth.mockReset();
    createProjectFromSource.mockReset();
    redirect.mockClear();

    requirePageAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("redirects to the created project on success", async () => {
    createProjectFromSource.mockResolvedValueOnce({ id: "project_123" });

    const { createProjectAction } = await import("./actions");
    const formData = new FormData();
    formData.set("source", JSON.stringify({ kind: "demo", demoId: "ocean-depth" }));

    await expect(createProjectAction(formData)).rejects.toThrow("NEXT_REDIRECT:/projects/project_123");
    expect(createProjectFromSource).toHaveBeenCalledWith(
      "user_test_123",
      { kind: "demo", demoId: "ocean-depth" },
      undefined,
    );
  });

  it("redirects back to the library with a degraded notice when creation hits a retryable backend failure", async () => {
    createProjectFromSource.mockRejectedValueOnce(
      new Error("Failed query: insert into projects\ncause: connect ECONNREFUSED 127.0.0.1:5432"),
    );

    const { createProjectAction } = await import("./actions");
    const formData = new FormData();
    formData.set("source", JSON.stringify({ kind: "blank" }));

    await expect(createProjectAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/library?workspace=create_failed",
    );
  });
});
