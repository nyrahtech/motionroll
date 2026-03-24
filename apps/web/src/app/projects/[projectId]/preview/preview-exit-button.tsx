"use client";

export function PreviewExitButton({
  projectId,
}: {
  projectId: string;
}) {
  return (
    <button
      type="button"
      className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/40"
      style={{ background: "rgba(10,12,18,0.88)", borderColor: "rgba(255,255,255,0.16)" }}
      onClick={() => {
        window.close();
        window.location.href = `/projects/${projectId}`;
      }}
    >
      &lt;- Exit preview
    </button>
  );
}
