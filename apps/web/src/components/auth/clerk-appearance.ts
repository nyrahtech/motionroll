import { dark } from "@clerk/themes";

export const clerkDarkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#7dd3fc",
    colorBackground: "#101722",
    colorInputBackground: "#0b1220",
    colorInputText: "#f8fafc",
    colorText: "#f8fafc",
    colorTextSecondary: "#94a3b8",
    colorNeutral: "#16202f",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    borderRadius: "14px",
    fontFamily: "Inter, sans-serif",
  },
  elements: {
    rootBox: "w-full max-w-md",
    card: "border border-[var(--editor-border)] bg-[var(--editor-panel)] shadow-none",
    formButtonPrimary:
      "bg-[var(--editor-accent)] text-slate-950 shadow-none hover:bg-[var(--editor-accent)]/90",
    formFieldInput:
      "border border-[var(--editor-border)] bg-[var(--editor-shell)] text-[var(--editor-text)] shadow-none",
    dividerLine: "bg-[var(--editor-border)]",
    socialButtonsBlockButton:
      "border border-[var(--editor-border)] bg-[var(--editor-shell)] text-[var(--editor-text)] shadow-none hover:bg-[var(--editor-panel-alt)]",
    alertClerkError: "border border-rose-500/30 bg-rose-950/40 text-rose-200",
    otpCodeFieldInput:
      "border border-[var(--editor-border)] bg-[var(--editor-shell)] text-[var(--editor-text)] shadow-none",
    userButtonPopoverCard: "border border-[var(--editor-border)] bg-[var(--editor-panel)] shadow-xl",
    userButtonPopoverMain: "bg-[var(--editor-panel)]",
    userButtonPopoverFooter: "border-t border-[var(--editor-border)] bg-[var(--editor-panel)]",
  },
} as const;
