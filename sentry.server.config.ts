// Sentry pa servern (produktspec avsnitt 13). Importeras av src/instrumentation.ts
// nar Next.js kor pa Node-runtimen.
//
// Valfritt precis som ANTHROPIC_API_KEY och NEXT_PUBLIC_GOOGLE_PLACES_KEY:
// saknas NEXT_PUBLIC_SENTRY_DSN initieras Sentry aldrig, och appen fungerar
// exakt som utan felrapportering. Se .env.example.
import * as Sentry from "@sentry/nextjs";
import { beforeBreadcrumb, beforeSend } from "@/lib/sentry-filter";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Ingen prestandasparning – malet ar att veta OM nagot gick sonder, inte
    // att matma latens (produktspec 13). Hall datamangden nere.
    tracesSampleRate: 0,
    // Ingen IP-adress, inga cookies, inga headers – se src/lib/sentry-filter.ts
    // for den fullstandiga listan over vad som filtreras och varfor.
    sendDefaultPii: false,
    beforeSend,
    beforeBreadcrumb,
  });
}
