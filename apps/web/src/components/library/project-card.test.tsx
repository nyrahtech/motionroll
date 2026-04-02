import React from "react";
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectCard } from "./project-card";

const { refresh, success, error } = vi.hoisted(() => ({
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    fill: _fill,
    unoptimized: _unoptimized,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean; priority?: boolean }) => (
    <img alt={alt} {...props} />
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success,
    error,
  },
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
});

describe("ProjectCard", () => {
  beforeEach(() => {
    cleanup();
    refresh.mockReset();
    success.mockReset();
    error.mockReset();
  });

  it("renders its metadata inside a blurred bottom overlay", () => {
    vi.stubGlobal("fetch", vi.fn());

    const { container } = render(
      <ProjectCard
        project={{
          id: "project-1",
          title: "Ocean Story",
          updatedAt: "2026-03-24T12:00:00.000Z",
          status: "draft",
          assets: [],
          publishTargets: [],
        } as any}
        href={"/projects/project-1"}
      />,
    );

    const overlay = container.querySelector("[data-project-card-overlay]");
    expect(overlay).toBeTruthy();
    expect(overlay?.className).toContain("backdrop-blur-lg");
    expect(overlay?.getAttribute("style")).toContain("linear-gradient");
  });

  it("keeps preview artwork from intercepting clicks meant for the project link", () => {
    vi.stubGlobal("fetch", vi.fn());

    const { container } = render(
      <ProjectCard
        project={{
          id: "project-1",
          title: "Ocean Story",
          updatedAt: "2026-03-24T12:00:00.000Z",
          status: "draft",
          assets: [],
          publishTargets: [],
        } as any}
        href={"/projects/project-1"}
      />,
    );

    const previewImage = container.querySelector("img");
    expect(previewImage?.className).toContain("pointer-events-none");
  });

  it("blocks repeated duplicate actions and project opening while duplicate is pending", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectCard
        project={{
          id: "project-1",
          title: "Ocean Story",
          updatedAt: "2026-03-24T12:00:00.000Z",
          status: "draft",
          assets: [],
          publishTargets: [],
        } as any}
        href={"/projects/project-1"}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Project actions" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Duplicate in progress")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Project actions" })).toBeNull();

    const anchor = screen.getByRole("link", { name: "Open Ocean Story" });
    const blockedClick = createEvent.click(anchor);
    fireEvent(anchor, blockedClick);
    expect(blockedClick.defaultPrevented).toBe(true);

    resolveFetch?.({
      ok: true,
      json: async () => ({}),
    } as Response);

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith("Project duplicated");
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the rename input visible but disabled while rename is pending", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectCard
        project={{
          id: "project-1",
          title: "Ocean Story",
          updatedAt: "2026-03-24T12:00:00.000Z",
          status: "draft",
          assets: [],
          publishTargets: [],
        } as any}
        href={"/projects/project-1"}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Project actions" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));

    const input = await screen.findByDisplayValue("Ocean Story");
    fireEvent.change(input, { target: { value: "Renamed Ocean Story" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Renamed Ocean Story" }),
      });
    });

    const pendingInput = screen.getByDisplayValue("Renamed Ocean Story");
    expect(pendingInput.hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Rename in progress")).toBeTruthy();

    resolveFetch?.({
      ok: false,
      json: async () => ({ error: "Rename failed." }),
    } as Response);

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith("Rename failed.");
    });
    expect(screen.getByDisplayValue("Ocean Story")).toBeTruthy();
    expect(screen.queryByLabelText("Rename in progress")).toBeNull();
  });

  it("locks the delete dialog while deletion is pending and re-enables it on failure", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectCard
        project={{
          id: "project-1",
          title: "Ocean Story",
          updatedAt: "2026-03-24T12:00:00.000Z",
          status: "draft",
          assets: [],
          publishTargets: [],
        } as any}
        href={"/projects/project-1"}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Project actions" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(screen.getByText("Delete project?")).toBeTruthy();
    expect(screen.getByLabelText("Delete warning")).toBeTruthy();
    const actionButtons = screen.getAllByRole("button");
    expect(actionButtons.findIndex((button) => button.textContent === "Cancel")).toBeLessThan(
      actionButtons.findIndex((button) => button.textContent === "Delete project"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    fireEvent.click(screen.getByRole("button", { name: "Deleting..." }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1", { method: "DELETE" });
    });

    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Deleting..." }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Project actions" }).hasAttribute("disabled")).toBe(true);

    const dialog = screen.getByText("Delete project?").closest("dialog");
    expect(dialog).toBeTruthy();

    fireEvent.click(dialog!);
    fireEvent(
      dialog!,
      new Event("cancel", {
        cancelable: true,
      }),
    );
    expect(screen.getByText("Delete project?")).toBeTruthy();

    resolveFetch?.({
      ok: false,
      json: async () => ({ error: "Delete failed." }),
    } as Response);

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith("Delete failed.");
    });
    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Delete project" }).hasAttribute("disabled")).toBe(false);
  });
});
