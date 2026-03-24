"use client";

import { createContext, useContext } from "react";

const AuthRuntimeContext = createContext<{ clerkMounted: boolean }>({
  clerkMounted: false,
});

export function AuthRuntimeProvider({
  clerkMounted,
  children,
}: {
  clerkMounted: boolean;
  children: React.ReactNode;
}) {
  return (
    <AuthRuntimeContext.Provider value={{ clerkMounted }}>
      {children}
    </AuthRuntimeContext.Provider>
  );
}

export function useAuthRuntime() {
  return useContext(AuthRuntimeContext);
}
