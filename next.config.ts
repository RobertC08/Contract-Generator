import type { NextConfig } from "next";
import path from "path";

const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  turbopack: {},
  webpack: (config) => {
    config.context = projectRoot;
    config.resolve ??= {};
    config.resolve.modules = [
      path.join(projectRoot, "node_modules"),
      ...(Array.isArray(config.resolve.modules) ? config.resolve.modules : ["node_modules"]),
    ];
    return config;
  },
};

export default nextConfig;
