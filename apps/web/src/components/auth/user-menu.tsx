"use client";

import { UserButton } from "@clerk/nextjs";
import { clerkUserButtonAppearance } from "./clerk-appearance";
import { useAuthRuntime } from "./auth-runtime-provider";

export function UserMenu() {
  const { clerkMounted } = useAuthRuntime();

  if (!clerkMounted) {
    return null;
  }

  return (
    <UserButton appearance={clerkUserButtonAppearance} />
  );
}
