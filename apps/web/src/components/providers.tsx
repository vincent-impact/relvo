"use client";

import { SessionProvider } from "next-auth/react";

// Fournit la session Auth.js aux Client Components (useSession). Les Server
// Components utilisent plutôt les helpers de @/server/auth-context.
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
