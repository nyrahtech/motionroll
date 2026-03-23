import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentsDir = fileURLToPath(new URL(".", import.meta.url));
const appDir = path.resolve(componentsDir, "../app");

describe("ui copy hygiene", () => {
  it("keeps key launch surfaces ASCII-clean", () => {
    const sources = [
      path.resolve(componentsDir, "library/library-page.tsx"),
      path.resolve(componentsDir, "builder/provider-panel.tsx"),
      path.resolve(componentsDir, "builder/upload-panel.tsx"),
      path.resolve(componentsDir, "publish/publish-panel.tsx"),
      path.resolve(appDir, "projects/[projectId]/preview/page.tsx"),
    ].map((filePath) => fs.readFileSync(filePath, "utf8"));

    for (const source of sources) {
      expect(source).not.toMatch(/[^\x00-\x7F]/);
    }
  });
});
