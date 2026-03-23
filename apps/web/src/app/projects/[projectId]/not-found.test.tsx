import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProjectNotFound from "./not-found";

describe("ProjectNotFound", () => {
  it("renders a project-level not found state", () => {
    render(<ProjectNotFound />);

    expect(screen.getByText("Project not found")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "This project is missing or unavailable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to library" }).getAttribute("href")).toBe("/library");
  });
});
