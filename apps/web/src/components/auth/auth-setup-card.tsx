type AuthSetupCardProps = {
  title?: string;
  body?: string;
};

export function AuthSetupCard({
  title = "Authentication setup required",
  body = "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable MotionRoll sign-in.",
}: AuthSetupCardProps) {
  return (
    <div
      className="w-full max-w-md rounded-[20px] border p-6"
      style={{
        background: "var(--editor-panel)",
        borderColor: "var(--editor-border)",
        color: "var(--editor-text)",
      }}
    >
      <p
        className="text-xs font-medium uppercase tracking-[0.16em]"
        style={{ color: "var(--editor-text-dim)" }}
      >
        MotionRoll
      </p>
      <h1 className="mt-3 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
        {body}
      </p>
    </div>
  );
}
