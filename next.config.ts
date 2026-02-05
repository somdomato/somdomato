import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        // No Permissions-Policy header: setting an empty value caused structured header parse errors in browsers
        headers: [],
      },
    ];
  },
};

export default nextConfig;
