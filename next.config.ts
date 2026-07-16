import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly declare workspace root to prevent lockfile detection ambiguity
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
