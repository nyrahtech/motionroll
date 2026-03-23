import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ProjectNotFound() {
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
            Project not found
          </p>
          <h1 className="mt-2 text-xl font-semibold">This project is missing or unavailable</h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
            MotionRoll could not find a project at this address for your account. Return to the
            library to open a different project.
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
