"use client";

import { useEffect } from "react";

export function usePreviewStageHotkeys(onPlayToggle: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput = target?.tagName === "INPUT" || target?.contentEditable === "true";
      if (event.code !== "Space" || isTextInput) {
        return;
      }
      event.preventDefault();
      onPlayToggle();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPlayToggle]);
}
