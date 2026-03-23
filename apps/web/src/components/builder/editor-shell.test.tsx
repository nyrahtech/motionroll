import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SidebarPanel } from "./editor-sidebar";

const componentDir = path.resolve(process.cwd(), "src", "components", "builder");

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
    const sidebarSource = fs.readFileSync(
      path.resolve(componentDir, "editor-sidebar.tsx"),
      "utf8",
    );
    const inspectorSource = fs.readFileSync(
      path.resolve(componentDir, "editor-inspector.tsx"),
      "utf8",
    );

    expect(sidebarSource).toContain('activeContext === "upload"');
    expect(sidebarSource).toContain('activeContext === "ai"');
    expect(sidebarSource).toContain('label="Add Text"');
    expect(sidebarSource).toContain('label="Add Image"');
    expect(sidebarSource).toContain('label="Import Video"');
    expect(sidebarSource).toContain('label="AI Import"');
    expect(sidebarSource).not.toContain("Build the scene one clear layer at a time");
    expect(sidebarSource).not.toContain("Keep the inspector focused on the selected block and its motion.");
    expect(sidebarSource).not.toContain('title="Inspector"');
    expect(sidebarSource).not.toContain('title={usesMedia ? "Media" : "Text"}');
    expect(sidebarSource).not.toContain("SelectionHeader");
    expect(inspectorSource).toContain("SelectTrigger");
    expect(inspectorSource).toContain('label="Background"');
    expect(inspectorSource).toContain("ColorPicker");
    expect(inspectorSource).toContain('opacity={backgroundOpacity}');
    expect(inspectorSource).not.toContain("backgroundEnabled");
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
    const panelSource = fs.readFileSync(
      path.resolve(componentDir, "timeline-panel.tsx"),
      "utf8",
    );
    const rowSource = fs.readFileSync(
      path.resolve(componentDir, "timeline", "TimelineTrackRow.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("RotateCcw");
    expect(panelSource).toContain("RotateCw");
    expect(panelSource).toContain("Plus");
    expect(panelSource).toContain('title={label}');
    expect(panelSource).not.toContain("TooltipContent");
    expect(panelSource).toContain('aria-label={label}');
    expect(panelSource).toContain("justify-self-center");
    expect(rowSource).toContain('title="Open clip actions"');
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
      path.resolve(componentDir, "hooks", "useEditorPersistence.ts"),
      "utf8",
    );

    expect(source).toContain("navigator.sendBeacon");
    expect(source).toContain("pagehide");
    expect(source).toContain("beforeunload");
  });
});
