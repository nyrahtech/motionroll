import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppRouteError from "./error";

describe("AppRouteError", () => {
  it("renders a workspace recovery UI and retries through reset", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reset = vi.fn();

    render(
      <AppRouteError
        error={Object.assign(new Error("workspace failed"), { digest: "workspace_unavailable" })}
        reset={reset}
      />,
    );

    expect(screen.getByText("Workspace unavailable")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "This MotionRoll page could not load right now" })).toBeTruthy();
    expect(screen.getByText("workspace_unavailable")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open library" }).getAttribute("href")).toBe("/library");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
    consoleWarn.mockRestore();
  });
});
