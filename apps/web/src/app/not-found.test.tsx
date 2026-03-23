import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AppNotFound from "./not-found";

describe("AppNotFound", () => {
  it("renders a workspace-level not found state", () => {
    render(<AppNotFound />);

    expect(screen.getByText("Not found")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "That MotionRoll page does not exist" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to library" }).getAttribute("href")).toBe("/library");
  });
});
