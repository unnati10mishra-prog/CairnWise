import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: process.env.API_URL
          ? `${process.env.API_URL}/v1/:path*`
          : 'http://127.0.0.1:8765/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
