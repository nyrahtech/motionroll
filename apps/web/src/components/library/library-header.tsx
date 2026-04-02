"use client";

import { Plus } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { LibraryAccentButton } from "./library-accent-button";

export function LibraryHeader({
  isCreating,
  onCreate,
}: {
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <header
      className="flex h-14 items-center justify-between border-b px-4"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex-shrink-0 text-sm font-semibold tracking-wide"
          style={{ color: "var(--editor-accent)" }}
        >
          MotionRoll
        </span>
      </div>

      <div className="flex items-center gap-2">
        <LibraryAccentButton type="button" onClick={onCreate} disabled={isCreating} size="lg">
          <Plus className="h-4 w-4" />
          {isCreating ? "Creating..." : "New Project"}
        </LibraryAccentButton>
        <UserMenu />
      </div>
    </header>
  );
}
