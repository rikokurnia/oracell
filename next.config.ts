import type { NextConfig } from "next";
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/v1/oracle/feeds", destination: "/api/oracle/feeds" },
      { source: "/v1/oracle/quote", destination: "/api/oracle/quote" },
      { source: "/health", destination: "/api/oracle/health" },
    ];
  },
};
export default config;
