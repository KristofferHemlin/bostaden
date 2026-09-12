// Sentry i webblasaren (produktspec avsnitt 13). Laddas automatiskt av Next.js
// via Sentys byggplugin (withSentryConfig i next.config.ts) – ingen manuell
// import nagon annanstans.
//
// Valfritt: saknas NEXT_PUBLIC_SENTRY_DSN initieras Sentry aldrig. DSN:en far
// vara NEXT_PUBLIC_ eftersom en DSN inte ar hemlig – den later bara klienten
// SKICKA handelser, aldrig lasa nagot (se .env.example).
//
// Session Replay (som spelar in skarmen) aktiveras INTE – kvittobilder och
// belopp syns pa skarmen i det har granssnittet, och en inspelning av det vore
// precis den typen av personuppgift produktspec 13 forbjuder.
import * as Sentry from "@sentry/nextjs";
import { beforeBreadcrumb, beforeSend } from "@/lib/sentry-filter";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend,
    beforeBreadcrumb,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
