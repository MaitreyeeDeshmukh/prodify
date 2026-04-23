import { createClient } from '@insforge/sdk';

// InsForge BaaS client — singleton to avoid multiple connections in dev (hot-reload)
const globalForInsforge = globalThis as unknown as {
  insforge: ReturnType<typeof createClient>;
};

function makeInsforgeClient() {
  return createClient({
    baseUrl: process.env.INSFORGE_URL!,
    anonKey: process.env.INSFORGE_ANON_KEY,
    isServerMode: true, // we're always server-side in Next.js API routes
  });
}

export const insforge =
  globalForInsforge.insforge ?? makeInsforgeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForInsforge.insforge = insforge;
}
