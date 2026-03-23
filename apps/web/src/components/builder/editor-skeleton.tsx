/**
 * EditorSkeleton — dark placeholder shown while the editor bundle loads.
 * Matches editor chrome dimensions to prevent layout shift.
 */
export function EditorSkeleton() {
  return (
    <div
      className="flex h-screen min-h-screen flex-col overflow-hidden"
      style={{ background: "var(--editor-shell)", color: "var(--editor-text)" }}
    >
      {/* Top bar skeleton */}
      <div
        className="flex h-14 flex-shrink-0 items-center gap-3 border-b px-4"
        style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
      >
        <div className="h-5 w-24 animate-pulse rounded-md" style={{ background: "var(--editor-border)" }} />
        <div className="mx-2 h-4 w-px" style={{ background: "var(--editor-border)" }} />
        <div className="h-5 w-40 animate-pulse rounded-md" style={{ background: "var(--editor-border)" }} />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-7 w-16 animate-pulse rounded-[10px]" style={{ background: "var(--editor-border)" }} />
          <div className="h-7 w-20 animate-pulse rounded-[10px]" style={{ background: "var(--editor-border)" }} />
        </div>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div
          className="w-64 flex-shrink-0 border-r"
          style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
        >
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-[10px]"
                style={{ background: "var(--editor-border)", opacity: 1 - i * 0.15 }}
              />
            ))}
          </div>
        </div>

        {/* Preview area skeleton */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="flex min-h-0 flex-1 items-center justify-center"
            style={{ background: "var(--editor-shell)" }}
          >
            <div className="flex flex-col items-center gap-3 opacity-40">
              <div
                className="h-3 w-3 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--editor-accent)", borderTopColor: "transparent" }}
              />
              <span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>
                Loading editor…
              </span>
            </div>
          </div>

          {/* Timeline skeleton */}
          <div
            className="h-[292px] flex-shrink-0 border-t"
            style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
          >
            <div className="flex h-8 items-center gap-2 border-b px-4" style={{ borderColor: "var(--editor-border)" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 w-16 animate-pulse rounded" style={{ background: "var(--editor-border)" }} />
              ))}
            </div>
            <div className="space-y-px p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex h-10 items-center gap-2 rounded px-2">
                  <div className="h-3 w-20 animate-pulse rounded" style={{ background: "var(--editor-border)" }} />
                  <div
                    className="h-7 animate-pulse rounded"
                    style={{ background: "var(--editor-border)", width: `${40 + i * 15}%`, opacity: 0.7 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inspector skeleton */}
        <div
          className="w-64 flex-shrink-0 border-l"
          style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
        >
          <div className="space-y-4 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-12 animate-pulse rounded" style={{ background: "var(--editor-border)" }} />
                <div className="h-8 animate-pulse rounded-[10px]" style={{ background: "var(--editor-border)", opacity: 0.7 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
