import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Lets a phone on the home Wi-Fi use the dev server by its network address
  // (for example http://192.168.0.125:3000). Dev mode only.
  allowedDevOrigins: ["192.168.*.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        port: "",
        pathname: "/t/p/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
