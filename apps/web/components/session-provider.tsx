'use client';

import { SessionProvider } from 'next-auth/react';

// SessionProvider must be a client component
export default function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
