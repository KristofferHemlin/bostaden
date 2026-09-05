import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // heic-convert drar in en WASM-byggd libheif som inte ska buntas av Next.
  serverExternalPackages: ["heic-convert"],
  // Ingen forhojd bodySizeLimit for server actions langre: kvittobilder laddas
  // upp DIREKT fran webblasaren till Supabase Storage via signerade URL:er och
  // passerar aldrig en server action. Kvarvarande actions bar bara sma
  // JSON-nyttolaster och ryms i standardgransen.
};

export default nextConfig;
