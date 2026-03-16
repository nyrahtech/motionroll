import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentDir = fileURLToPath(new URL(".", import.meta.url));
const appDir = path.resolve(componentDir, "../../app");

describe("publish panel runtime preview", () => {
  it("uses an iframe instead of the editor preview runtime", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "publish-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("<iframe");
    expect(source).not.toContain("RuntimePreview");
    expect(source).toContain("/preview");
    expect(source).toContain("mode=");
    expect(source).toContain("forceSequence=1");
    expect(source).toContain('device === "desktop" ? "desktop" : "mobile"');
    expect(source).toContain('width: isDesktopPreview ? "100%"');
  });

  it("allows runtime mode overrides on preview and embed pages", () => {
    const previewSource = fs.readFileSync(
      path.resolve(appDir, "projects/[projectId]/preview/page.tsx"),
      "utf8",
    );
    const embedSource = fs.readFileSync(
      path.resolve(appDir, "embed/[slug]/page.tsx"),
      "utf8",
    );

    expect(previewSource).toContain("searchParams");
    expect(previewSource).toContain("resolveRuntimeMode");
    expect(previewSource).toContain("resolveForceSequence");
    expect(previewSource).not.toContain("overflow-x-hidden");
    expect(embedSource).toContain("searchParams");
    expect(embedSource).toContain("resolveRuntimeMode");
    expect(embedSource).toContain("resolveForceSequence");
    expect(embedSource).not.toContain("overflow-x-hidden");
  });
});
