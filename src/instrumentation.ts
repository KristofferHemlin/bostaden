// Next.js egen instrumenteringskrok. Laddar Sentys server-/edge-konfiguration
// beroende pa runtime, och kopplar in Sentrys egen fangst av fel som slapper
// igenom Server Components-rendering och route handlers (produktspec avsnitt
// 13, punkt 1: "ett fel ska landa någonstans läsbart").
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
