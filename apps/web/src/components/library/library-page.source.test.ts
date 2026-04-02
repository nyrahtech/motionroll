import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentDir = fileURLToPath(new URL(".", import.meta.url));

describe("library page structure", () => {
  it("uses examples and owned-project language instead of templates", () => {
    const pageSource = fs.readFileSync(
      path.resolve(componentDir, "library-page.tsx"),
      "utf8",
    );
    const demosSource = fs.readFileSync(
      path.resolve(componentDir, "demo-projects-section.tsx"),
      "utf8",
    );
    const projectsSource = fs.readFileSync(
      path.resolve(componentDir, "my-projects-section.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("DemoProjectsSection");
    expect(pageSource).toContain("MyProjectsSection");
    expect(pageSource).not.toContain("Templates");
    expect(pageSource).not.toContain("Default Projects");
    expect(demosSource).toContain("Explore Examples");
    expect(projectsSource).toContain("Your Projects");
  });

  it("creates library projects through the API with a source-based contract", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "library-page.tsx"),
      "utf8",
    );

    expect(source).toContain('fetch("/api/projects"');
    expect(source).toContain('kind: "blank"');
    expect(source).toContain('kind: "demo"');
    expect(source).toContain("window.location.assign(`/projects/${project.id}`)");
  });

  it("keeps the library chrome on MotionRoll design tokens", () => {
    const pageSource = fs.readFileSync(
      path.resolve(componentDir, "library-page.tsx"),
      "utf8",
    );
    const header = fs.readFileSync(
      path.resolve(componentDir, "library-header.tsx"),
      "utf8",
    );
    const hero = fs.readFileSync(
      path.resolve(componentDir, "featured-demo-project-card.tsx"),
      "utf8",
    );
    const demoCard = fs.readFileSync(
      path.resolve(componentDir, "demo-project-card.tsx"),
      "utf8",
    );
    const accentButton = fs.readFileSync(
      path.resolve(componentDir, "library-accent-button.tsx"),
      "utf8",
    );
    const projectCard = fs.readFileSync(
      path.resolve(componentDir, "project-card.tsx"),
      "utf8",
    );
    const actionsMenu = fs.readFileSync(
      path.resolve(componentDir, "project-actions-menu.tsx"),
      "utf8",
    );
    const myProjects = fs.readFileSync(
      path.resolve(componentDir, "my-projects-section.tsx"),
      "utf8",
    );
    const search = fs.readFileSync(
      path.resolve(componentDir, "project-search.tsx"),
      "utf8",
    );

    expect(header).toContain('className="flex h-14 items-center justify-between border-b px-4"');
    expect(header).toContain("LibraryAccentButton");
    expect(accentButton).toContain("var(--editor-accent)");
    expect(accentButton).toContain("#0a0a0b");
    expect(hero).toContain("Featured example");
    expect(hero).not.toContain("rounded-[32px]");
    expect(hero).toContain("color-mix(");
    expect(demoCard).toContain("Example");
    expect(demoCard).toContain("Open Demo");
    expect(demoCard).not.toContain("project.subtitle");
    expect(demoCard).not.toContain("project.detail");
    expect(hero).not.toContain("Opens a demo as a new editable project.");
    expect(projectCard).toContain("color-mix(");
    expect(projectCard).toContain("Delete warning");
    expect(actionsMenu).toContain("Copy");
    expect(actionsMenu).not.toContain("Archive");
    expect(actionsMenu).not.toContain("Confirm delete");
    expect(myProjects).toContain("NewProjectCard");
    expect(search).toContain("Search projects");
    expect(pageSource).not.toContain("Search filters Your Projects only.");
  });

  it("curates the examples section to a featured plus two layout", () => {
    const demosSource = fs.readFileSync(
      path.resolve(componentDir, "demo-projects-section.tsx"),
      "utf8",
    );

    expect(demosSource).toContain('project.id === "product-reveal"');
    expect(demosSource).toContain('project.id === "product-spin"');
    expect(demosSource).not.toContain('project.id === "editorial-story"');
    expect(demosSource).toContain("xl:grid-rows-2");
    expect(demosSource).toContain("xl:items-stretch");
  });
});
