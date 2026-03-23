export function WorkspaceDegradedBanner({
  message = "Some workspace data couldn't load right now. Existing projects or demos may be temporarily unavailable.",
}: {
  message?: string;
}) {
  return (
    <div
      className="mb-6 rounded-lg border px-4 py-3 text-sm"
      style={{
        background: "color-mix(in srgb, var(--editor-panel) 78%, #6b4f00 22%)",
        borderColor: "color-mix(in srgb, var(--editor-border) 55%, #d4a017 45%)",
        color: "var(--editor-text)",
      }}
    >
      {message}
    </div>
  );
}
