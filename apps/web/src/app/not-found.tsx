import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AppNotFound() {
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
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--editor-text-dim)" }}
          >
            Not found
          </p>
          <h1 className="mt-2 text-xl font-semibold">That MotionRoll page does not exist</h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
            The page you tried to open is missing or no longer available. Head back to the library
            and continue from there.
          </p>

          <div className="mt-6">
            <Link
              href="/library"
              className="inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to library
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
