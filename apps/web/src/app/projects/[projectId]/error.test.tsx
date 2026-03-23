import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectRouteError from "./error";

describe("ProjectRouteError", () => {
  it("renders a recovery UI and retries through reset", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reset = vi.fn();

    render(
      <ProjectRouteError
        error={Object.assign(new Error("manifest failed"), { digest: "draft_unavailable" })}
        reset={reset}
      />,
    );

    expect(screen.getByText("Project unavailable")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "This project could not load right now" })).toBeTruthy();
    expect(screen.getByText("draft_unavailable")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to library" }).getAttribute("href")).toBe("/library");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);

    consoleWarn.mockRestore();
  });
});
