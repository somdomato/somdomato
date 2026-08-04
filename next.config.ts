import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": ["./next.config.ts"],
  },
  // Checagem de tipos roda separada em scripts/deploy.sh (via `tsc --noEmit`)
  // antes do build — rodar de novo aqui empilha a memória do tsc em cima da
  // do compilador Turbopack no mesmo processo, o que já causou OOM no deploy.
  typescript: {
    ignoreBuildErrors: true,
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
