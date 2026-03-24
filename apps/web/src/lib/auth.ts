import { auth as clerkAuth, currentUser as getClerkCurrentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export type AuthUser = {
  userId: string;
  email: string;
  name: string;
};

const TEST_AUTH_USER_ID_HEADER = "x-motionroll-test-user-id";
const TEST_AUTH_EMAIL_HEADER = "x-motionroll-test-user-email";
const TEST_AUTH_NAME_HEADER = "x-motionroll-test-user-name";

export function isClerkAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

export function isTestAuthBypassEnabled() {
  return process.env.MOTIONROLL_TEST_AUTH_BYPASS?.trim() === "true";
}

async function getTestAuthUser(): Promise<AuthUser | null> {
  if (!isTestAuthBypassEnabled()) {
    return null;
  }

  const requestHeaders = await headers();
  const userId = requestHeaders.get(TEST_AUTH_USER_ID_HEADER);
  if (!userId) {
    return null;
  }

  return {
    userId,
    email:
      requestHeaders.get(TEST_AUTH_EMAIL_HEADER) ??
      `${userId}@test.motionroll.local`,
    name: requestHeaders.get(TEST_AUTH_NAME_HEADER) ?? "MotionRoll Test User",
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const testUser = await getTestAuthUser();
  if (testUser) {
    return testUser;
  }

  if (!isClerkAuthConfigured()) {
    return null;
  }

  const { userId } = await clerkAuth();
  if (!userId) {
    return null;
  }

  const user = await getClerkCurrentUser();
  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    email:
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "",
    name:
      user.fullName ??
      [user.firstName, user.lastName].filter(Boolean).join(" ") ??
      "MotionRoll User",
  };
}

export async function requireAuth(): Promise<AuthUser> {
  if (!isClerkAuthConfigured() && !isTestAuthBypassEnabled()) {
    throw NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export async function requirePageAuth(): Promise<AuthUser> {
  if (!isClerkAuthConfigured() && !isTestAuthBypassEnabled()) {
    redirect("/sign-in" as Parameters<typeof redirect>[0]);
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in" as Parameters<typeof redirect>[0]);
  }

  return user;
}

export async function requireOwnership(ownerId: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.userId !== ownerId) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}
