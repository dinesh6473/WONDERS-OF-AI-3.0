/* eslint-disable @typescript-eslint/no-require-imports */
import type { NextConfig } from "next";

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: {
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["10.0.10.238:3000", "localhost:3000"],
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

// export default withPWA(nextConfig);
export default nextConfig;
