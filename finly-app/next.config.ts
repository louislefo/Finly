import type { NextConfig } from "next";

const isExport = process.env.NEXT_OUTPUT_MODE === "export";

const nextConfig: NextConfig = {
  output: isExport ? "export" : "standalone",
  trailingSlash: isExport,
  images: {
    unoptimized: isExport,
  },
  ...(isExport
    ? {}
    : {
        async redirects() {
          return [
            {
              source: "/dashboard",
              destination: "/",
              permanent: true,
            },
          ];
        },
        async rewrites() {
          const backendUrl =
            process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
          return [
            {
              source: "/api/v1/:path*",
              destination: `${backendUrl}/api/v1/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;

