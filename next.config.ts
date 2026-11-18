import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // Native SQLite driver must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["better-sqlite3"],
  // Every page is per-user (identity header + language cookie), so cacheComponents is left off.
  experimental: {
    serverActions: {
      // Photos are uploaded through server actions.
      bodySizeLimit: "25mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
