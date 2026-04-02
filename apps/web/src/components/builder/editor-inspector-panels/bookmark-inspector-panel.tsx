"use client";

import React from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import type { SidebarPanelProps } from "../editor-sidebar";
import { Field, numberInputClassName, SectionLabel } from "../editor-inspector-primitives";

type BookmarkInspectorPanelProps = Pick<
  SidebarPanelProps,
  | "selectedBookmark"
  | "onBookmarkFieldChange"
  | "onBookmarkJump"
  | "onDeleteBookmark"
>;

export function BookmarkInspectorPanel({
  selectedBookmark,
  onBookmarkFieldChange,
  onBookmarkJump,
  onDeleteBookmark,
}: BookmarkInspectorPanelProps) {
  if (!selectedBookmark) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <SectionLabel>Bookmark</SectionLabel>
        <Field label="Label">
          <Input
            aria-label="Bookmark label"
            value={selectedBookmark.title}
            onChange={(event) => onBookmarkFieldChange?.("title", event.currentTarget.value)}
          />
        </Field>
        <Field label="Position">
          <Input
            aria-label="Bookmark position"
            className={numberInputClassName}
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={selectedBookmark.position}
            onChange={(event) =>
              onBookmarkFieldChange?.("position", Number(event.currentTarget.value))
            }
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onBookmarkJump}>
            Jump to bookmark
          </Button>
          <Button type="button" variant="quiet" size="sm" onClick={onDeleteBookmark}>
            Delete bookmark
          </Button>
        </div>
      </div>
    </div>
  );
}
