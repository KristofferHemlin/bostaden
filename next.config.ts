import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // heic-convert drar in en WASM-byggd libheif som inte ska buntas av Next.
  serverExternalPackages: ["heic-convert"],
  // Ingen forhojd bodySizeLimit for server actions langre: kvittobilder laddas
  // upp DIREKT fran webblasaren till Supabase Storage via signerade URL:er och
  // passerar aldrig en server action. Kvarvarande actions bar bara sma
  // JSON-nyttolaster och ryms i standardgransen.
};

// Sentry (produktspec avsnitt 13). Kallkodsuppladdningen (for lasbara
// stacktraces) kraver SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN – saknas de
// hoppar pluginet bara over det steget, bygget gar igenom som vanligt.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  telemetry: false,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
});
