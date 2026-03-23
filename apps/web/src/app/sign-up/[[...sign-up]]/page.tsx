import { SignUp } from "@clerk/nextjs";
import { AuthSetupCard } from "@/components/auth/auth-setup-card";
import { isClerkAuthConfigured } from "@/lib/auth";

export default function SignUpPage() {
  return (
    <main
      className="grid min-h-screen place-items-center px-6 py-12"
      style={{ background: "var(--editor-shell)" }}
    >
      {isClerkAuthConfigured() ? (
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          forceRedirectUrl="/"
        />
      ) : (
        <AuthSetupCard />
      )}
    </main>
  );
}
