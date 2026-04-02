"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectDraftDocument } from "@motionroll/shared";
import type { SidebarContext } from "../editor-sidebar";
import { sortBookmarks, sortLayers } from "../project-builder-restored.helpers";

export function useProjectEditorSelectionState(draft: ProjectDraftDocument) {
  const [selectedBookmarkId, setSelectedBookmarkId] = useState(draft.bookmarks[0]?.id ?? "");
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [sidebarContext, setSidebarContext] = useState<SidebarContext>("edit");

  const orderedBookmarks = useMemo(() => sortBookmarks(draft.bookmarks), [draft.bookmarks]);
  const orderedLayers = useMemo(() => sortLayers(draft.layers), [draft.layers]);
  const selectedBookmark = orderedBookmarks.find((bookmark) => bookmark.id === selectedBookmarkId);
  const selectedLayer = orderedLayers.find((layer) => layer.id === selectedLayerId);

  useEffect(() => {
    if (selectedLayerId || selectedBookmarkId) {
      setSidebarContext("edit");
      return;
    }
    setSidebarContext((current) => (current === "upload" ? current : "insert"));
  }, [selectedBookmarkId, selectedLayerId]);

  return {
    orderedBookmarks,
    orderedLayers,
    selectedBookmark,
    selectedBookmarkId,
    selectedLayer,
    selectedLayerId,
    setSelectedBookmarkId,
    setSelectedLayerId,
    setSidebarContext,
    sidebarContext,
  };
}
