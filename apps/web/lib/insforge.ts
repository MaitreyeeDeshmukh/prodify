import { createClient } from '@insforge/sdk';

// InsForge BaaS client — singleton to avoid multiple connections in dev (hot-reload)
const globalForInsforge = globalThis as unknown as {
  insforge: ReturnType<typeof createClient>;
};

function makeInsforgeClient() {
  return createClient({
    baseUrl: (process.env.INSFORGE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL)!,
    anonKey: process.env.INSFORGE_ANON_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    isServerMode: true,
  });
}

export const insforge =
  globalForInsforge.insforge ?? makeInsforgeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForInsforge.insforge = insforge;
}

export function getUserInsforge(accessToken: string | undefined) {
  if (!accessToken) return insforge;
  return createClient({
    baseUrl: (process.env.INSFORGE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL)!,
    anonKey: process.env.INSFORGE_ANON_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    isServerMode: true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
