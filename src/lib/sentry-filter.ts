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
//   - xhr/fetch-brodsmular begransas till url, metod och statuskod, och url:en
//     saneras dessutom (se saneraBreadcrumbUrl): query-strangen strippas
//     alltid, oavsett doman – den kan bara en atkomsttoken pa samma satt som
//     en Authorization-header. Sokvagen mot lagringen (signerade lankar till
//     bilagor) strips ocksa, eftersom den bar bostad_id och kostnad_id –
//     tillsammans med anvandar-id:t (se nedan) blir det annars en logg over
//     vilka kvitton en person oppnat.
//
//   - FELETS EGET MEDDELANDE saneras (saneraText), sedan 2026-11-20. Filtret
//     ovan rensade strukturen men inte strangen, och strangen ar dar
//     uppgifterna stod: Prismas valideringsfel skriver ut anropets argument
//     ordagrant, och en matning visade en leverantor och en gatuadress i
//     klartext i meddelandet (CLAUDE.md, "Ett filter som rensar strukturen men
//     inte meddelandet rensar ingenting"). Argumentträdet tas bort; raderna
//     som namnger falt och typ star kvar, sa att felet gar att felsoka. E-post
//     och sokparametrar i fullstandiga adresser tas bort i varje meddelande.
//     Stackramarna saneras pa samma satt: webblasarens stacktolkare laser
//     rader ur ett flerradigt meddelande som ramar.
//   - Sidans adress, Referer och navigeringsbrodsmulorna bar inte sina
//     sokparametrar, pa samma satt som anropsbrodsmulorna.
//   - Konsolbrodsmulor skickas inte alls: deras argument ar fri text och
//     skickades ordagrant ("… Bauhaus 12 000 kr", uppmatt i Chrome). Det som
//     skrivs till konsolen pa servern finns kvar i driftens egna loggar.
//   - Klickbrodsmulornas elementattribut (title, aria-label och liknande) tas
//     bort; taggen och klasserna star kvar.
//
// Sentry far inget nar inget har hant: sessionerna och klientrapporterna ar
// avstangda (UTAN_SESSIONER nedan, sendClientReports: false i konfigerna).
//
// Session Replay (som spelar in skarmen, inklusive kvittobilder) aktiveras
// ALDRIG – integrationen laggs helt enkelt aldrig till nagonstans.

import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Integrationerna som skickar en session vid varje sidladdning, navigering
 * och processtart – utan att nagot fel intraffat. Policyn beskriver Sentry som
 * tekniska felrapporter, och da ska Sentry inte fa nagot nar inget hant.
 * Uppmatt 2026-11-20: tva kuvert per sidladdning for en inloggad, det andra
 * med anvandarens id. Det som forsvinner ar Sentrys "release health"
 * (andelen kraschfria sessioner); ingen kod i appen anvander den.
 */
export const SESSIONSINTEGRATIONER = ["BrowserSession", "ProcessSession"];

/** Sentrys standardintegrationer utan sessionerna – for `integrations` i Sentry.init. */
export function utanSessioner<I extends { name: string }>(integrationer: I[]): I[] {
  return integrationer.filter((i) => !SESSIONSINTEGRATIONER.includes(i.name));
}

/** Ersatter argumentträdet i ett Prisma-fel – se saneraText. */
export const PRISMA_ARGUMENT_BORTTAGNA = "[anropets argument borttagna]";

/**
 * Tar bort det ur en text som kan bara uppgifter hon matat in, men behaller
 * det som behovs for att felsoka:
 *   - Prismas argumentträd ("Invalid `prisma.kostnad.findMany()` invocation:"
 *     foljt av { … } med varje varde). Rubriken och raderna efter tradet –
 *     "Argument `totalbelopp`: Invalid value provided. Expected …" – star kvar;
 *     de namnger falt och typ, inte varden.
 *   - E-postadresser.
 *   - Sokparametrar i fullstandiga adresser (de kan bara en atkomsttoken).
 */
export function saneraText(text: string): string {
  let ut = text;
  if (/Invalid `prisma\.[\w$]+\.[\w$]+\(\)` invocation/.test(ut)) {
    // Tradet borjar med en rad som bara ar "{" och slutar med en rad som bara
    // ar "}", bada i forsta kolumnen – Prismas egen formatering. De inre
    // klamrarna ar indragna och avslutar inte tradet.
    ut = ut.replace(/^\{[ \t]*\n[\s\S]*?\n\}[ \t]*$/m, PRISMA_ARGUMENT_BORTTAGNA);
  }
  ut = ut.replace(/[^\s@"'<>()[\]{},;:]+@[^\s@"'<>()[\]{},;:]+\.[a-z]{2,}/gi, "[e-post]");
  ut = ut.replace(/(\bhttps?:\/\/[^\s?#"'<>]+)\?[^\s"'<>]*/g, "$1");
  return ut;
}

/** En adress utan sokparametrar, relativ eller fullstandig. */
function utanSokparametrar(url: unknown): unknown {
  return typeof url === "string" ? url.split("?")[0] : url;
}

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
  if (typeof handelse.message === "string") handelse.message = saneraText(handelse.message);
  for (const undantag of handelse.exception?.values ?? []) {
    if (typeof undantag.value === "string") undantag.value = saneraText(undantag.value);
    // Stacktolkaren i webblasaren laser rader ur ett flerradigt meddelande som
    // stackramar, med texten som funktionsnamn och en adress som filnamn –
    // uppmatt 2026-11-20: en e-postadress och en token i en ram. Ramarna
    // saneras darfor som meddelandet.
    for (const ram of undantag.stacktrace?.frames ?? []) {
      for (const falt of ["function", "filename", "abs_path", "module"] as const) {
        const v = ram[falt];
        if (typeof v === "string") ram[falt] = utanSokparametrar(saneraText(v)) as string;
      }
    }
  }

  if (handelse.request) {
    handelse.request.url = utanSokparametrar(handelse.request.url) as string | undefined;
    delete handelse.request.cookies;
    delete handelse.request.data;
    delete handelse.request.query_string;
    if (handelse.request.headers) {
      const headers: Record<string, string> = { ...handelse.request.headers };
      delete headers.Cookie;
      delete headers.cookie;
      delete headers.Authorization;
      delete headers.authorization;
      for (const namn of ["Referer", "referer"]) {
        if (headers[namn]) headers[namn] = utanSokparametrar(headers[namn]) as string;
      }
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
    // Nexts egen kontext for ett fel pa servern bar sokvagen som den begardes.
    const nextjs = handelse.contexts.nextjs as Record<string, unknown> | undefined;
    if (nextjs && typeof nextjs.request_path === "string") {
      nextjs.request_path = utanSokparametrar(nextjs.request_path);
    }
  }

  return handelse;
}

/** Sokvagsprefixet for Supabase Storages REST-API – signerade bilagelankar gar hit. */
const LAGRINGS_SOKVAG = "/storage/v1/object/";

/**
 * Strippar query-strangen (kan bara en atkomsttoken) ur en breadcrumb-url,
 * oavsett doman. Ar sokvagen dessutom en lagringslank stryks aven den, sa att
 * bostad_id och kostnad_id inte foljer med – bara domanen blir kvar.
 */
export function saneraBreadcrumbUrl(url: unknown): unknown {
  if (typeof url !== "string") return url;

  let uppdelad: URL;
  try {
    uppdelad = new URL(url);
  } catch {
    // Ingen fullstandig URL (t.ex. en relativ sokvag) – ta bort en eventuell
    // query-strang for hand i stallet for att lata token slinka igenom.
    return url.split("?")[0];
  }

  if (uppdelad.pathname.startsWith(LAGRINGS_SOKVAG)) {
    return uppdelad.origin;
  }
  return uppdelad.origin + uppdelad.pathname;
}

/**
 * Begransar xhr/fetch-brodsmular till url, metod och statuskod – och saneras
 * url:en. Navigeringar far sina adresser utan sokparametrar, konsolen
 * skickas inte alls, och klickens elementattribut tas bort – se overst.
 */
export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  if (breadcrumb.category === "navigation" && breadcrumb.data) {
    const { from, to } = breadcrumb.data as Record<string, unknown>;
    breadcrumb.data = { from: utanSokparametrar(from), to: utanSokparametrar(to) };
    return breadcrumb;
  }
  if (breadcrumb.category?.startsWith("ui.") && typeof breadcrumb.message === "string") {
    breadcrumb.message = breadcrumb.message.replace(/\[[^\]=]+="[^"]*"\]/g, "");
  }
  if (typeof breadcrumb.message === "string") breadcrumb.message = saneraText(breadcrumb.message);
  if (
    (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") &&
    breadcrumb.data
  ) {
    const { url, method, status_code } = breadcrumb.data as Record<string, unknown>;
    breadcrumb.data = { url: saneraBreadcrumbUrl(url), method, status_code };
  }
  return breadcrumb;
}
