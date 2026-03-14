import type { ReactNode } from "react";

// The project editor is a full-screen app shell — skip the global nav
export default function ProjectLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
