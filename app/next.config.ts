import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow bridge server for API calls
  async rewrites() {
    return [
      {
        source: "/api/bridge/:path*",
        destination: `http://localhost:${process.env.BRIDGE_PORT || 3000}/:path*`,
      },
    ];
  },
};

export default nextConfig;
