import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentDir = path.resolve(process.cwd(), "src", "components", "builder");

describe("editor inspector primitives", () => {
  it("has accessible title attributes on icon-only formatting controls", () => {
    // These controls are now in editor-inspector-primitives.tsx after the sidebar split.
    const source = fs.readFileSync(
      path.resolve(componentDir, "editor-inspector-primitives.tsx"),
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
