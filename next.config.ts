import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [new URL("https://cdn.somdomato.com/**")],
  },
};

export default nextConfig;
