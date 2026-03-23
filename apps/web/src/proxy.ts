import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/embed/",
  "/api/publish/",
  "/api/health",
  "/sign-in",
  "/sign-up",
  "/_next/",
  "/favicon",
];

const TEST_AUTH_USER_ID_HEADER = "x-motionroll-test-user-id";

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

function isTestAuthBypassRequest(request: Request) {
  return (
    process.env.MOTIONROLL_TEST_AUTH_BYPASS?.trim() === "true" &&
    Boolean(request.headers.get(TEST_AUTH_USER_ID_HEADER))
  );
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || isTestAuthBypassRequest(request)) {
    return NextResponse.next();
  }

  if (!isClerkConfigured()) {
    if (!isApiPath(pathname)) {
      const signInUrl = new URL("/sign-in", request.url);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  await auth.protect();
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
