// Central ingang for felrapportering (produktspec avsnitt 13). Fungerar
// oberoende av miljo – @sentry/nextjs kor pa server, edge och klient bakom
// samma import.
//
// Sammanhanget som far skickas ar VITLISTAT i Felsammanhang har: sida, anrop
// och anvandar-id. Inget annat. Den som vill bifoga mer maste utoka typen har
// – inte smyga in fri text via ett `extra`-falt – sa att det aldrig blir ett
// genvag forbi filtreringen i src/lib/sentry-filter.ts.
//
// Rapporterar inte om ingen DSN ar konfigurerad – Sentry.captureException gor
// da ingenting (samma "valfritt, stor tyst om det saknas"-monster som
// ANTHROPIC_API_KEY).

import * as Sentry from "@sentry/nextjs";

export interface Felsammanhang {
  /** Sidan eller flodet felet horde till, t.ex. "kostnad/nytt" eller "export/paket". */
  sida: string;
  /** Vilket anrop som gick fel, t.ex. "sparaKostnad" eller "hamtaAnvandare". */
  anrop?: string;
  /** Bara id:t – aldrig e-post (produktspec 13: "Ett anvandar-id racker"). */
  anvandareId?: string;
}

export function rapporteraFel(fel: unknown, sammanhang: Felsammanhang): void {
  Sentry.captureException(fel, {
    tags: {
      sida: sammanhang.sida,
      anrop: sammanhang.anrop ?? "okant",
    },
    user: sammanhang.anvandareId ? { id: sammanhang.anvandareId } : undefined,
  });
}
