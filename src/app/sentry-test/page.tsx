// TILLFÄLLIG. Kastar ett fel direkt vid besök, för att verifiera att Sentry
// tar emot (produktspec avsnitt 13). Fångas av src/app/error.tsx, som
// rapporterar det klient-sidan; src/instrumentation.ts (onRequestError)
// rapporterar samma fel server-sidan via Next.js egen krok.
//
// Besök /sentry-test?klient=1 för att i stället rendera sidan med en knapp
// som anropar en odefinierad funktion i webbläsaren – verifierar Sentrys
// vanliga klientfelsuppsamling (window.onerror) i stället för render-felet.
//
// Tas bort igen efter verifiering – committa inte.

import { KlientFelKnapp } from "./KlientFelKnapp";

export default async function SentryTestSida({
  searchParams,
}: {
  searchParams: Promise<{ klient?: string }>;
}) {
  const { klient } = await searchParams;

  if (klient === "1") {
    return <KlientFelKnapp />;
  }

  throw new Error("Sentry-test: manuellt utlöst fel för att verifiera felrapportering.");
}
