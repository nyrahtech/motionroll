"use client";

import { UserButton } from "@clerk/nextjs";
import { clerkDarkAppearance } from "./clerk-appearance";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function UserMenu() {
  if (!clerkEnabled) {
    return null;
  }

  return (
    <UserButton
      appearance={{
        ...clerkDarkAppearance,
        elements: {
          ...clerkDarkAppearance.elements,
          userButtonAvatarBox: "h-8 w-8",
          userButtonTrigger:
            "focus:ring-1 focus:ring-[var(--editor-accent)] focus:ring-offset-0 rounded-full",
        },
      }}
    />
  );
}
