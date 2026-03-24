import { dark } from "@clerk/themes";

export const clerkDarkAppearance = {
  theme: dark,
  variables: {
    colorPrimary: "#7dd3fc",
    colorBackground: "#1a1a1c",
    colorInputBackground: "#0b1220",
    colorInputText: "#f8fafc",
    colorText: "#f8fafc",
    colorTextSecondary: "#94a3b8",
    colorNeutral: "#212124",
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    borderRadius: "10px",
    fontFamily: "Inter, sans-serif",
  },
  elements: {
    rootBox: "w-full max-w-md",
    card: "!rounded-[14px] !border-[var(--editor-border)] !bg-[var(--editor-panel)] !shadow-none",
    headerTitle: "!font-[var(--font-ui)] !text-[22px] !font-semibold !tracking-[-0.02em] !text-[var(--editor-text)]",
    headerSubtitle: "!text-[var(--editor-text-dim)]",
    formButtonPrimary:
      "rounded-[10px] !bg-[var(--editor-accent)] !text-slate-950 !shadow-none hover:!bg-[var(--editor-accent)]/90",
    formFieldLabel: "!text-[var(--editor-text)]/90 !font-medium",
    formFieldInput:
      "rounded-[10px] !border-[var(--editor-border)] !bg-[var(--editor-panel-elevated)] !text-[var(--editor-text)] !shadow-none placeholder:!text-[var(--editor-text-dim)]/70",
    formFieldInputShowPasswordButton:
      "!text-[var(--editor-text-dim)] hover:!text-[var(--editor-text)]",
    dividerLine: "!bg-[var(--editor-border)]",
    dividerText: "!text-[var(--editor-text-dim)]",
    socialButtonsBlockButton:
      "rounded-[10px] !border-[var(--editor-border)] !bg-[var(--editor-panel-elevated)] !text-[var(--editor-text)] !shadow-none hover:!bg-[var(--editor-hover)]",
    socialButtonsBlockButtonText: "!text-[var(--editor-text)]",
    socialButtonsProviderIcon: "!opacity-100",
    alertClerkError: "border border-rose-500/30 bg-rose-950/40 text-rose-200",
    otpCodeFieldInput:
      "!border-[var(--editor-border)] !bg-[var(--editor-panel-elevated)] !text-[var(--editor-text)] !shadow-none",
    footerActionText: "!text-[var(--editor-text-dim)]",
    footerActionLink: "!text-[var(--editor-accent)] hover:!text-[var(--editor-accent)]",
  },
} as const;

export const clerkBaseAppearance = {
  theme: dark,
  variables: {
    colorPrimary: "#7dd3fc",
  },
} as const;

export const clerkUserButtonAppearance = {
  theme: dark,
  variables: {
    colorPrimary: "#7dd3fc",
  },
  elements: {
    userButtonAvatarBox: "h-8 w-8",
    userButtonTrigger:
      "focus:ring-1 focus:ring-[var(--editor-accent)] focus:ring-offset-0 rounded-full",
  },
} as const;
