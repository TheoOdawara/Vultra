import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API Core is at localhost:3000 — frontends run on different ports
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
