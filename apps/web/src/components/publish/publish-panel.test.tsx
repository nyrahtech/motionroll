import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const componentDir = path.resolve(rootDir, "src/components/publish");
const appDir = path.resolve(rootDir, "src/app");

describe("publish panel runtime preview", () => {
  it("uses an iframe instead of the editor preview runtime", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "publish-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("<iframe");
    expect(source).not.toContain("RuntimePreview");
    expect(source).toContain("/preview");
    expect(source).toContain("mode: runtimeMode");
    expect(source).toContain('forceSequence: "1"');
    expect(source).toContain('params.set("embed", "1")');
    expect(source).toContain('device === "desktop" ? "desktop" : "mobile"');
    expect(source).toContain('md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
    expect(source).not.toContain(">Download<");
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
    expect(previewSource).toContain("resolveEmbeddedPreview");
    expect(previewSource).toContain("resolveLocalPreviewSessionId");
    expect(previewSource).not.toContain("overflow-x-hidden");
    expect(embedSource).toContain("searchParams");
    expect(embedSource).toContain("resolveRuntimeMode");
    expect(embedSource).toContain("resolveForceSequence");
    expect(embedSource).not.toContain("overflow-x-hidden");
  });
});
