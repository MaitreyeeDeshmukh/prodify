import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from common avatar/CDN sources
  images: {
    remotePatterns: [
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Ensure server-only packages don't leak to the client
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
