import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SidebarPanel } from "./editor-sidebar";

const componentDir = fileURLToPath(new URL(".", import.meta.url));

describe("editor shell", () => {
  it("renders the simplified sidebar content choices", () => {
    const markup = renderToStaticMarkup(
      <SidebarPanel
        overlays={[]}
        selection={null}
        onOverlayFieldChange={() => undefined}
        onOverlayStyleChange={() => undefined}
        onOverlayAnimationChange={() => undefined}
        onOverlayTransitionChange={() => undefined}
        onSelectOverlay={() => undefined}
        onAddContent={() => undefined}
      />,
    );

    expect(markup).toContain("Video");
    expect(markup).toContain("Text");
    expect(markup).toContain("Image");
    expect(markup).toContain("Section");
    expect(markup).not.toContain("Add content");
  });

  it("keeps viewport controls in the top bar source", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "editor-top-bar.tsx"),
      "utf8",
    );

    expect(source).toContain("Desktop");
    expect(source).toContain("Mobile");
    expect(source).toContain("Reduced motion");
    expect(source).toContain("Retry sync");
    expect(source).toContain("Sync now");
  });

  it("disables preview-stage sub-controls at the source level", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "preview-stage.tsx"),
      "utf8",
    );

    expect(source).toContain("showControls={false}");
    expect(source).not.toContain("Live preview");
  });

  it("keeps a background sync path in the editor source", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "project-builder.tsx"),
      "utf8",
    );

    expect(source).toContain("navigator.sendBeacon");
    expect(source).toContain("pagehide");
    expect(source).toContain("beforeunload");
  });
});
