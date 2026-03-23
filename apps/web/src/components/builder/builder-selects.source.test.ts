import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentDir = fileURLToPath(new URL(".", import.meta.url));

describe("builder select styling", () => {
  it("uses themed selects for builder preset pickers", () => {
    const toolbarSource = fs.readFileSync(
      path.resolve(componentDir, "editor-toolbar.tsx"),
      "utf8",
    );
    const inspectorSource = fs.readFileSync(
      path.resolve(componentDir, "inspector-pane.tsx"),
      "utf8",
    );

    expect(toolbarSource).toContain("SelectTrigger");
    expect(toolbarSource).not.toContain("<select");
    expect(inspectorSource).toContain("SelectTrigger");
    expect(inspectorSource).not.toContain("<select");
  });
});
