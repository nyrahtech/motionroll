import { SignIn } from "@clerk/nextjs";
import { AuthSetupCard } from "@/components/auth/auth-setup-card";
import { clerkDarkAppearance } from "@/components/auth/clerk-appearance";
import { isClerkAuthConfigured } from "@/lib/auth";

export default function SignInPage() {
  return (
    <main
      className="grid min-h-screen place-items-center px-6 py-12"
      style={{ background: "var(--editor-shell)" }}
    >
      {isClerkAuthConfigured() ? (
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/library"
          appearance={clerkDarkAppearance}
        />
      ) : (
        <AuthSetupCard />
      )}
    </main>
  );
}
