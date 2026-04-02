"use client";

import React from "react";
import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

export function ProjectActionsMenu({
  onRename,
  onDuplicate,
  onDelete,
  disabled = false,
  loading = false,
}: {
  onRename: () => void;
  onDuplicate: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Project actions"
          aria-busy={loading}
          disabled={disabled}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--editor-hover)]"
          style={{ color: "var(--editor-text-dim)" }}
        >
          {loading ? (
            <span
              aria-label="Project action in progress"
              className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void onDuplicate()}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => void onDelete()}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
