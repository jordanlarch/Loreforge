import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@app/config", "@app/db", "@app/engine"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
