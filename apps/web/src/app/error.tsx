"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { getClientErrorReference, logHandledClientError } from "../components/error/client-error-log";

export default function AppRouteError({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  useEffect(() => {
    logHandledClientError("[MotionRoll App Route Error]", error);
  }, [error]);

  const errorReference = getClientErrorReference(error, "app_route_error");

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "var(--editor-shell)", color: "var(--editor-text)" }}
    >
      <header
        className="flex h-14 items-center border-b px-6"
        style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--editor-accent)" }}>
          MotionRoll
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-lg rounded-xl border p-6"
          style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(248,113,113,0.12)] text-[#f87171]">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--editor-text-dim)" }}
          >
            Workspace unavailable
          </p>
          <h1 className="mt-2 text-xl font-semibold">This MotionRoll page could not load right now</h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
            MotionRoll hit a temporary problem while loading your workspace. Try again now, or head
            back to the library and reopen what you need in a moment.
          </p>

          <p className="mt-4 text-xs" style={{ color: "var(--editor-text-dim)" }}>
            Reference: <span style={{ color: "var(--editor-text)" }}>{errorReference}</span>
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="flex h-10 items-center gap-2 rounded px-4 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
            <a
              href="/library"
              className="flex h-10 items-center rounded border px-4 text-sm transition-colors hover:bg-[var(--editor-hover)]"
              style={{ borderColor: "var(--editor-border)", color: "var(--editor-text)" }}
            >
              Open library
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
