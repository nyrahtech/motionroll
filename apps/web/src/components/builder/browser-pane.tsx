"use client";

import { Clapperboard, Layers3, Type, Upload } from "lucide-react";
import { UploadPanel } from "./upload-panel";
import { AssetList, OverlayList } from "./browser-lists";
import type { EditorPaneTab, EditorProject } from "./editor-types";
import { BrowserPanel, LeftIconRail, RailButton } from "./editor-shell";
import type { ProjectManifest } from "@motionroll/shared";

const railTabs = ["assets", "overlays", "imports"] as const satisfies readonly EditorPaneTab[];

export function EditorRailNav({
  activeTab,
  browserOpen,
  onTabChange,
  onPublish,
}: {
  activeTab: EditorPaneTab;
  browserOpen: boolean;
  onTabChange: (tab: EditorPaneTab) => void;
  onPublish: () => void;
}) {
  return (
    <LeftIconRail>
      {railTabs.map((tab) => {
        const active = browserOpen && activeTab === tab;
        return (
          <RailButton
            key={tab}
            active={active}
            label={tab === "assets" ? "Media" : tab === "overlays" ? "Text" : "Source"}
            onClick={() => onTabChange(tab)}
          >
            {tab === "assets" ? (
              <Clapperboard className="h-4 w-4" />
            ) : tab === "overlays" ? (
              <Type className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </RailButton>
        );
      })}
      <div className="mt-auto w-full">
        <RailButton label="Publish" onClick={onPublish}>
          <Layers3 className="h-4 w-4" />
        </RailButton>
      </div>
    </LeftIconRail>
  );
}

export function BrowserPane({
  tab,
  search,
  onSearchChange,
  project,
  manifest,
  selectedOverlayId,
  onOverlaySelect,
  onReplaceSource,
}: {
  tab: EditorPaneTab;
  search: string;
  onSearchChange: (value: string) => void;
  project: EditorProject;
  manifest: ProjectManifest;
  selectedOverlayId: string | null;
  onOverlaySelect: (overlayId: string) => void;
  onReplaceSource: () => void;
}) {
  const title =
    tab === "assets" ? "Media" : tab === "overlays" ? "Text blocks" : "Source video";

  return (
    <BrowserPanel title={title} searchValue={search} onSearchChange={onSearchChange}>
      <div className="space-y-3">
        {tab === "assets" ? (
          <AssetList project={project} onReplaceSource={onReplaceSource} search={search} />
        ) : null}

        {tab === "overlays" ? (
          <OverlayList
            section={manifest.sections[0]}
            selectedOverlayId={selectedOverlayId}
            onSelect={onOverlaySelect}
            search={search}
          />
        ) : null}

        {tab === "imports" ? (
          <UploadPanel projectId={project.id} />
        ) : null}
      </div>
    </BrowserPanel>
  );
}
