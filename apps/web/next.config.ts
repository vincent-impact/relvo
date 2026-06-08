import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @relvo/db expose du TypeScript brut (src/index.ts + client Prisma généré) :
  // Next doit le transpiler comme du code applicatif.
  transpilePackages: ["@relvo/db"],
};

export default nextConfig;
