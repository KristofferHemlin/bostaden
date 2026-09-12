// Sentry pa edge-runtimen (t.ex. src/middleware.ts). Importeras av
// src/instrumentation.ts. Se sentry.server.config.ts for resonemanget –
// samma valfrihet, samma filtrering.
import * as Sentry from "@sentry/nextjs";
import { beforeBreadcrumb, beforeSend } from "@/lib/sentry-filter";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend,
    beforeBreadcrumb,
  });
}
