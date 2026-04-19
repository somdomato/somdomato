import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["./next.config.ts"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    localPatterns: [
      { pathname: "/images/covers/**" },
      { pathname: "/covers/**" },
      { pathname: "/images/**" },
    ],
    remotePatterns: [
      new URL("https://cdn.somdomato.com/**"),
      new URL("https://i.ytimg.com/**"),
      new URL("https://cdn-images.dzcdn.net/**"),
    ],
  },
};

export default nextConfig;
