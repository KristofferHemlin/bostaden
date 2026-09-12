// Delad filtrering for Sentry, anvand av bade klient-, server- och
// edge-konfigurationen (instrumentation-client.ts, sentry.server.config.ts,
// sentry.edge.config.ts). Se produktspec avsnitt 13, "Ingen personlig
// information i felrapporterna".
//
// EXPLICIT FILTRERAT BORT, i klartext:
//   - Forfragans cookies, Authorization/Cookie-headers, body och query-strang
//     (body kan innehalla formularfalt som belopp och leverantor).
//   - Allt pa anvandarobjektet utom id – aldrig e-post, aldrig IP-adress
//     (sendDefaultPii star dessutom explicit till false i alla tre konfigerna).
//   - Varje nyckel i extra/contexts vars NAMN matchar den forbjudna listan
//     nedan (belopp, leverantor, adress, filnamn, kvitto, anteckning, e-post,
//     kopeskilling, identifiering), aven om nagon rakar bifoga sadant i
//     framtiden – vardet ersatts med "[borttaget]", nyckeln finns kvar sa att
//     det syns ATT nagot filtrerades.
//   - xhr/fetch-brodsmular begransas till url, metod och statuskod. Sentry
//     samlar redan inte in request-/svarskroppar i den har typen av brodsmulor,
//     men listan star har explicit i stallet for att lita pa standardbeteendet.
//
// Session Replay (som spelar in skarmen, inklusive kvittobilder) aktiveras
// ALDRIG – integrationen laggs helt enkelt aldrig till nagonstans.

import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";

const FORBJUDNA_NYCKLAR =
  /belopp|kronor|oren|leverantor|leverantör|adress|address|filnamn|filename|kvitto|anteckning|epost|e-post|email|kopeskilling|identifiering/i;

function rensaVarde(varde: unknown): unknown {
  if (Array.isArray(varde)) return varde.map(rensaVarde);
  if (varde && typeof varde === "object") {
    const resultat: Record<string, unknown> = {};
    for (const [nyckel, v] of Object.entries(varde as Record<string, unknown>)) {
      resultat[nyckel] = FORBJUDNA_NYCKLAR.test(nyckel) ? "[borttaget]" : rensaVarde(v);
    }
    return resultat;
  }
  return varde;
}

/** Kors pa varje felhandelse innan den skickas till Sentry. */
export function beforeSend(handelse: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (handelse.request) {
    delete handelse.request.cookies;
    delete handelse.request.data;
    delete handelse.request.query_string;
    if (handelse.request.headers) {
      const headers: Record<string, string> = { ...handelse.request.headers };
      delete headers.Cookie;
      delete headers.cookie;
      delete headers.Authorization;
      delete headers.authorization;
      handelse.request.headers = headers;
    }
  }

  if (handelse.user) {
    handelse.user = handelse.user.id ? { id: handelse.user.id } : undefined;
  }

  if (handelse.extra) {
    handelse.extra = rensaVarde(handelse.extra) as typeof handelse.extra;
  }
  if (handelse.contexts) {
    handelse.contexts = rensaVarde(handelse.contexts) as typeof handelse.contexts;
  }

  return handelse;
}

/** Begransar xhr/fetch-brodsmular till url, metod och statuskod. */
export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (
    (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") &&
    breadcrumb.data
  ) {
    const { url, method, status_code } = breadcrumb.data as Record<string, unknown>;
    breadcrumb.data = { url, method, status_code };
  }
  return breadcrumb;
}
