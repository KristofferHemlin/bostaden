import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // heic-convert drar in en WASM-byggd libheif som inte ska buntas av Next.
  serverExternalPackages: ["heic-convert"],
  experimental: {
    serverActions: {
      // Kvittobilder laddas upp genom server actions. Max 10 MB per fil
      // (produktspec 12) plus RSC-overhead och flera filer i samma inskick.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
