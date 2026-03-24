import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@uppy/core/css/style.min.css";
import "@uppy/drag-drop/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import "./globals.css";
import { isClerkAuthConfigured, isTestAuthBypassEnabled } from "@/lib/auth";
import { clerkBaseAppearance } from "@/components/auth/clerk-appearance";
import { AuthRuntimeProvider } from "@/components/auth/auth-runtime-provider";
import { assertClerkConfigurationIsValid } from "@/lib/clerk-config";

export const metadata: Metadata = {
  title: "MotionRoll",
  description: "Editor-first scroll storytelling tool",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const authConfigured = isClerkAuthConfigured();
  const testAuthBypassEnabled = isTestAuthBypassEnabled();
  const shouldMountClerk = authConfigured && !testAuthBypassEnabled;

  if (shouldMountClerk) {
    await assertClerkConfigurationIsValid();
  }

  const content = (
    <html lang="en">
      <body
        suppressHydrationWarning
        style={{
          background: "var(--editor-shell)",
          color: "var(--editor-text)",
          fontFamily: "Inter, sans-serif",
          margin: 0,
          padding: 0,
          minHeight: "100vh",
        }}
      >
        <AuthRuntimeProvider clerkMounted={shouldMountClerk}>
          {children}
        </AuthRuntimeProvider>
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--editor-panel)",
              color: "var(--editor-text)",
              border: "1px solid var(--editor-border)",
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );

  if (shouldMountClerk) {
    return (
      <ClerkProvider
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        afterSignOutUrl="/sign-in"
        appearance={clerkBaseAppearance}
      >
        {content}
      </ClerkProvider>
    );
  }

  return (
    content
  );
}
