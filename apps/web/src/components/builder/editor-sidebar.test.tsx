import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentDir = fileURLToPath(new URL(".", import.meta.url));

describe("editor sidebar", () => {
  it("backs native titles onto icon-only formatting controls", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "editor-sidebar.tsx"),
      "utf8",
    );

    expect(source).toContain('title="Align left"');
    expect(source).toContain('title="Align center"');
    expect(source).toContain('title="Align right"');
    expect(source).toContain('title="Bold"');
    expect(source).toContain('title="Italic"');
    expect(source).toContain('title="Underline"');
  });
});
