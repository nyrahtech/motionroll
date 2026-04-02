import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OverlayDefinition } from "@motionroll/shared";

import { SidebarPanel } from "./editor-sidebar";

const componentDir = path.resolve(process.cwd(), "src", "components", "builder");

function readBuilderSource(...relativePaths: string[]) {
  return relativePaths
    .map((relativePath) => fs.readFileSync(path.resolve(componentDir, relativePath), "utf8"))
    .join("\n");
}

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
        onOverlayEnterAnimationChange={() => undefined}
        onOverlayExitAnimationChange={() => undefined}
        onAddContent={() => undefined}
      />,
    );

    expect(markup).toContain("Add Video");
    expect(markup).toContain("Add Text");
    expect(markup).toContain("Add Image");
    expect(markup).not.toContain("Add content");
  });

  it("keeps sidebar actions persistent and wording compact", () => {
    const sidebarSource = readBuilderSource("editor-sidebar.tsx");
    const inspectorSource = readBuilderSource(
      "editor-inspector.tsx",
      "editor-inspector-panels/layer-inspector-panel.tsx",
      "editor-inspector-panels/canvas-inspector-panel.tsx",
    );

    expect(sidebarSource).toContain('activeContext === "upload"');
    expect(sidebarSource).toContain('label="Add Text"');
    expect(sidebarSource).toContain('label="Add Image"');
    expect(sidebarSource).toContain('label="Add Video"');
    expect(sidebarSource).not.toContain("AI Import");
    expect(sidebarSource).not.toContain("Build the scene one clear layer at a time");
    expect(sidebarSource).not.toContain("Keep the inspector focused on the selected block and its motion.");
    expect(sidebarSource).not.toContain('title="Inspector"');
    expect(sidebarSource).not.toContain('title={usesMedia ? "Media" : "Text"}');
    expect(sidebarSource).not.toContain("SelectionHeader");
    expect(inspectorSource).toContain("SelectTrigger");
    expect(inspectorSource).toContain("<SectionLabel>Content</SectionLabel>");
    expect(inspectorSource).toContain("<SectionLabel>Style</SectionLabel>");
    expect(inspectorSource).toContain("<SectionLabel>Animation</SectionLabel>");
    expect(inspectorSource).toContain("Enter");
    expect(inspectorSource).toContain("Exit");
    expect(inspectorSource).toContain('label="Background"');
    expect(inspectorSource).toContain("ColorPicker");
    expect(inspectorSource).toContain('opacity={style?.opacity ?? 1}');
    expect(inspectorSource).toContain('opacity={backgroundOpacity}');
    expect(inspectorSource).not.toContain("This block stays visible for the full timeline clip");
    expect(inspectorSource).not.toContain("Lifetime:");
    expect(inspectorSource).not.toContain("backgroundEnabled");
  });

  it("renders logical inspector sections for a selected text overlay", () => {
    const selectedOverlay = {
      id: "overlay-1",
      timing: { start: 0.1, end: 0.5 },
      content: {
        type: "text",
        text: "Hello MotionRoll",
        linkHref: "",
        style: {
          fontFamily: "Inter",
          fontSize: 34,
          fontWeight: 600,
          color: "#ffffff",
          textAlign: "start",
        },
        background: {
          enabled: true,
          color: "#0d1016",
          opacity: 0.82,
        },
        enterAnimation: {
          type: "fade",
          easing: "ease-out",
          duration: 0.45,
          delay: 0,
        },
        exitAnimation: {
          type: "none",
          easing: "ease-in-out",
          duration: 0.35,
        },
      },
    } as OverlayDefinition;

    const markup = renderToStaticMarkup(
      <SidebarPanel
        projectId="project-1"
        activeContext="edit"
        selectedOverlay={selectedOverlay}
        onContextChange={() => undefined}
        onOverlayFieldChange={() => undefined}
        onOverlayStyleChange={() => undefined}
        onOverlayStyleLiveChange={() => undefined}
        onOverlayEnterAnimationChange={() => undefined}
        onOverlayExitAnimationChange={() => undefined}
        onAddContent={() => undefined}
      />,
    );

    expect(markup).toContain(">Content<");
    expect(markup).toContain(">Style<");
    expect(markup).toContain(">Animation<");
    expect(markup).toContain(">Enter<");
    expect(markup).toContain(">Exit<");
    expect(markup).toContain(">Text<");
    expect(markup).toContain(">Link<");
    expect(markup).toContain(">Background<");
  });

  it("renders separate detach and remove actions for a canvas background video", () => {
    const markup = renderToStaticMarkup(
      <SidebarPanel
        projectId="project-1"
        activeContext="insert"
        canvasSettings={{
          title: "Canvas",
          frameRangeStart: 0,
          frameRangeEnd: 191,
          scrollHeightVh: 220,
          scrubStrength: 1,
          backgroundColor: "#101114",
          backgroundMedia: {
            assetId: "asset-background",
            url: "https://example.com/background.mp4",
          },
          backgroundVideoEndBehavior: "loop",
        }}
        onContextChange={() => undefined}
        onCanvasBackgroundColorChange={() => undefined}
        onCanvasBackgroundEndBehaviorChange={() => undefined}
        onDetachCanvasBackground={() => undefined}
        onRemoveCanvasBackground={() => undefined}
        onOverlayFieldChange={() => undefined}
        onOverlayStyleChange={() => undefined}
        onOverlayStyleLiveChange={() => undefined}
        onOverlayEnterAnimationChange={() => undefined}
        onOverlayExitAnimationChange={() => undefined}
        onAddContent={() => undefined}
      />,
    );

    expect(markup).toContain("Detach background");
    expect(markup).toContain("Remove background");
  });

  it("keeps the color picker popover above builder overlays", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "..", "ui", "color-picker.tsx"),
      "utf8",
    );
    const toolbarSource = fs.readFileSync(
      path.resolve(componentDir, "inline-text-toolbar.tsx"),
      "utf8",
    );

    expect(source).toContain('className="z-[2147483646] w-[248px] rounded-[14px]');
    expect(source).toContain("data-overlay-selection-chrome={selectionChrome ? \"true\" : undefined}");
    expect(toolbarSource).toContain("<SelectContent selectionChrome>");
    expect(toolbarSource).toContain("selectionChrome");
  });

  it("keeps viewport controls in the top bar source", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "editor-top-bar.tsx"),
      "utf8",
    );

    expect(source).toContain("Desktop");
    expect(source).toContain("Mobile");
    expect(source).toContain('label: "Save"');
    expect(source).toContain("Retry sync");
    expect(source).not.toContain("Sync now");
    expect(source).not.toContain("RotateCcw");
    expect(source).not.toContain("RotateCw");
  });

  it("keeps undo and redo in the editor transport source", () => {
    const panelSource = readBuilderSource("timeline-panel.tsx", "timeline-playback-strip.tsx");
    const rowSource = readBuilderSource("timeline/TimelineTrackRow.tsx");

    expect(panelSource).toContain("RotateCcw");
    expect(panelSource).toContain("RotateCw");
    expect(panelSource).toContain("Plus");
    expect(panelSource).toContain('title={label}');
    expect(panelSource).not.toContain("TooltipContent");
    expect(panelSource).toContain('aria-label={label}');
    expect(panelSource).toContain("justify-self-center");
    expect(rowSource).toContain('title="Open clip actions"');
  });

  it("keeps preview-stage free of sub-controls at the source level", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "preview-stage.tsx"),
      "utf8",
    );

    expect(source).toContain("showControls={false}");
    expect(source).not.toContain("PreviewControls");
  });

  it("keeps preview runtime tied to the single canvas manifest", () => {
    const source = readBuilderSource("runtime-preview.tsx", "runtime-preview-utils.ts");

    expect(source).toContain("function getManifestSection(");
    expect(source).toContain("return manifest.sections[0];");
    expect(source).toContain("function hasRenderableCanvasContent(manifest: ProjectManifest)");
    expect(source).not.toContain("activeSceneId");
  });

  it("keeps media overlay blend on the media node in preview source", () => {
    const runtimePreviewSource = readBuilderSource("runtime-preview.tsx", "runtime-preview-utils.ts");
    const runtimeOverlaySource = fs.readFileSync(
      path.resolve(process.cwd(), "..", "..", "packages", "runtime", "src", "modules", "overlay-dom.ts"),
      "utf8",
    );

    expect(runtimePreviewSource).toContain("media.style.mixBlendMode = mediaOverlay");
    expect(runtimePreviewSource).toContain('card.style.mixBlendMode = "normal"');
    expect(runtimeOverlaySource).toContain("card.style.mixBlendMode = \"normal\"");
    expect(runtimeOverlaySource).toContain("media.style.mixBlendMode = isMediaCapableOverlay(overlay)");
  });

  it("keeps transparent text overlays content-sized in preview and runtime source", () => {
    const runtimePreviewSource = readBuilderSource("runtime-preview.tsx", "runtime-preview-utils.ts");
    const runtimeOverlaySource = fs.readFileSync(
      path.resolve(process.cwd(), "..", "..", "packages", "runtime", "src", "modules", "overlay-dom.ts"),
      "utf8",
    );

    expect(runtimePreviewSource).toContain('const contentSizedOverlay = overlay.content.type === "text" && !bg?.enabled');
    expect(runtimePreviewSource).toContain('card.style.width = contentSizedOverlay ? "auto"');
    expect(runtimeOverlaySource).toContain('const contentSizedOverlay = overlay.content.type === "text" && !background?.enabled');
    expect(runtimeOverlaySource).toContain('card.style.width = contentSizedOverlay ? "auto"');
  });

  it("keeps a background sync path in the editor source", () => {
    const persistenceSource = readBuilderSource("hooks/useProjectEditorPersistence.ts");
    const builderSource = readBuilderSource(
      "project-builder-restored.tsx",
      "hooks/useProjectEditorActions.ts",
    );

    expect(persistenceSource).toContain("navigator.sendBeacon");
    expect(persistenceSource).toContain("pagehide");
    expect(persistenceSource).toContain("beforeunload");
    expect(persistenceSource).toContain("keepalive: true");
    expect(builderSource).toContain("createLocalPreviewSession");
    expect(builderSource).toContain("createLocalPreviewSession(projectState.id, previewManifest)");
  });

  it("treats canvas background clears as authoritative in the restored builder source", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "project-builder-restored.tsx"),
      "utf8",
    );

    expect(source).toContain("onDetachCanvasBackground");
    expect(source).toContain("onRemoveCanvasBackground");
    expect(source).toContain("backgroundTrack: undefined");
  });

  it("keeps bookmark and layer selection separate in the restored builder source", () => {
    const source = readBuilderSource(
      "project-builder-restored.tsx",
      "hooks/useProjectEditorSelectionState.ts",
      "hooks/useProjectEditorPreviewHandlers.ts",
    );

    expect(source).toContain("const [selectedBookmarkId, setSelectedBookmarkId] = useState");
    expect(source).toContain("const [selectedLayerId, setSelectedLayerId] = useState");
    expect(source).toContain('setSelectedBookmarkId("");');
    expect(source).not.toContain("activeSceneId");
  });

  it("does not render bookmark highlight as selection during playback", () => {
    const rowSource = fs.readFileSync(
      path.resolve(componentDir, "timeline", "TimelineTrackRow.tsx"),
      "utf8",
    );

    expect(rowSource).toContain("(!isPlaying && Boolean(clip.metadata?.isSelectedBookmark))");
  });

  it("does not keep playhead-driven scene switching in the restored builder source", () => {
    const source = fs.readFileSync(
      path.resolve(componentDir, "project-builder-restored.tsx"),
      "utf8",
    );

    expect(source).not.toContain("flushSync");
    expect(source).not.toContain("syncActiveSceneToPlayhead");
    expect(source).not.toContain("activeSceneId");
  });

  it("builds local preview sessions from the restored single-canvas manifest", () => {
    const source = readBuilderSource(
      "project-builder-restored.tsx",
      "hooks/useProjectEditorActions.ts",
    );

    expect(source).toContain("const previewManifest = useMemo");
    expect(source).toContain("createLocalPreviewSession(projectState.id, previewManifest)");
    expect(source).toContain("manifest={previewManifest}");
  });

  it("does not keep next-scene prewarm hooks in the active preview source", () => {
    const builderSource = readBuilderSource("project-builder-restored.tsx");
    const previewStageSource = fs.readFileSync(
      path.resolve(componentDir, "preview-stage.tsx"),
      "utf8",
    );
    const runtimePreviewSource = readBuilderSource("runtime-preview.tsx", "runtime-preview-utils.ts");

    expect(builderSource).toContain("const previewManifest = useMemo");
    expect(builderSource).toContain("manifest={previewManifest}");
    expect(previewStageSource).not.toContain("nextScenePrewarm");
    expect(previewStageSource).not.toContain("activeSceneId");
    expect(runtimePreviewSource).toContain("hasRenderableCanvasContent");
    expect(runtimePreviewSource).toContain("manifest.canvas.backgroundTrack");
  });

  it("keeps preview playhead sync wired through the restored builder source", () => {
    const builderSource = fs.readFileSync(
      path.resolve(componentDir, "project-builder-restored.tsx"),
      "utf8",
    );

    expect(builderSource).toContain("playback={playback.playback}");
    expect(builderSource).toContain("onPlayheadChange={playback.seekPlayhead}");
    expect(builderSource).toContain("onPlayToggle={playback.togglePlay}");
  });
});
