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
        projectId="project-1"
        activeContext="insert"
        onContextChange={() => undefined}
        onOverlayFieldChange={() => undefined}
        onOverlayStyleChange={() => undefined}
        onOverlayStyleLiveChange={() => undefined}
        onOverlayAnimationChange={() => undefined}
        onOverlayTransitionChange={() => undefined}
        onAddContent={() => undefined}
      />,
    );

    expect(markup).toContain("Import Video");
    expect(markup).toContain("Add Text");
    expect(markup).toContain("Add Image");
    expect(markup).not.toContain("Add content");
  });

  it("keeps sidebar actions persistent and wording compact", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "editor-sidebar.tsx"),
      "utf8",
    );

    expect(source).toContain('activeContext === "upload"');
    expect(source).toContain('activeContext === "ai"');
    expect(source).toContain('label="Add Text"');
    expect(source).toContain('label="Add Image"');
    expect(source).toContain('label="Import Video"');
    expect(source).toContain('label="AI Import"');
    expect(source).not.toContain("Build the scene one clear layer at a time");
    expect(source).not.toContain("Keep the inspector focused on the selected block and its motion.");
    expect(source).not.toContain('title="Inspector"');
    expect(source).not.toContain('title={usesMedia ? "Media" : "Text"}');
    expect(source).not.toContain("SelectionHeader");
    expect(source).toContain("SelectTrigger");
    expect(source).toContain('label="Background"');
    expect(source).toContain("ColorPicker");
    expect(source).toContain('opacity={backgroundOpacity}');
    expect(source).not.toContain("backgroundEnabled");
  });

  it("keeps viewport controls in the top bar source", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "editor-top-bar.tsx"),
      "utf8",
    );

    expect(source).toContain("Desktop");
    expect(source).toContain("Mobile");
    expect(source).toContain("Retry sync");
    expect(source).toContain("Sync now");
    expect(source).not.toContain("RotateCcw");
    expect(source).not.toContain("RotateCw");
  });

  it("keeps undo and redo in the editor transport source", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "timeline-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("RotateCcw");
    expect(source).toContain("RotateCw");
    expect(source).toContain("Plus");
    expect(source).toContain('title={label}');
    expect(source).toContain('title="Open clip actions"');
    expect(source).not.toContain("TooltipContent");
    expect(source).toContain('aria-label={label}');
    expect(source).toContain("justify-self-center");
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
