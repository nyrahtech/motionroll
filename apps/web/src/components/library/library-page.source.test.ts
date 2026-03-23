import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentDir = fileURLToPath(new URL(".", import.meta.url));

describe("library page polish", () => {
  it("uses the themed select primitive for library filters", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "library-page.tsx"),
      "utf8",
    );

    expect(source).toContain("SelectTrigger");
    expect(source).toContain("SelectContent");
    expect(source).toContain("SelectItem");
    expect(source).not.toContain("<select");
  });

  it("refreshes the signed-in shell instead of forcing full-page reloads for project actions", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "library-page.tsx"),
      "utf8",
    );

    expect(source).toContain("router.refresh()");
    expect(source).not.toContain("window.location.reload()");
    expect(source).toContain("readJsonError");
  });

  it("wires keyboard navigation to real project card focus targets", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "library-page.tsx"),
      "utf8",
    );

    expect(source).toContain("[data-project-card]");
    expect(source).toContain("data-project-card");
    expect(source).toContain("ref={gridRef}");
  });

  it("creates library projects through the API and routes into the editor", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "library-page.tsx"),
      "utf8",
    );

    expect(source).toContain('fetch("/api/projects"');
    expect(source).toContain("window.location.assign(`/projects/${project.id}`)");
    expect(source).not.toContain('<form action={createProjectAction}>');
  });
});
