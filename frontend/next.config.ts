import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/run',
        destination: 'http://localhost:8000/run',
      },
      {
        source: '/run_sse',
        destination: 'http://localhost:8000/run_sse',
      },
      {
        source: '/apps/:path*',
        destination: 'http://localhost:8000/apps/:path*',
      },
    ];
  },
};

export default nextConfig;
