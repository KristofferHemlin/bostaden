// Vagen tillbaka fran installningarna (docs/design.md, "Installningssidan":
// "Att lämna inställningarna leder tillbaka dit man kom ifrån"). Kugghjulet
// skickar med vilken flik hon stod i, och bakatlanken namnger fliken – fran
// en sida langre in leder den till fliken, inte till sidan.
//
// Oversikten har ingen post: en lank "← Översikt" ar aldrig ratt, eftersom
// Oversikt ar en flik och flikraden alltid ligger inom rackhall
// (docs/design.md, Navigation). Sidor som inte hor till nagon flik –
// genomgangen, bostadens fragekort – ger heller ingen lank.
//
// Ren modul utan "use client", sa att bade kugghjulet (klient) och
// installningssidan (server) kan lasa samma tabell.

export const FLIKAR_TILLBAKA = {
  kvitton: { href: "/kostnad", text: "Kvitton" },
  projekt: { href: "/projekt", text: "Projekt" },
  deklaration: { href: "/export", text: "Deklaration" },
} as const;

export type FlikTillbaka = keyof typeof FLIKAR_TILLBAKA;

/** Fliken en sokvag hor till, eller null for oversikten och sidor utan flik. */
export function flikForSokvag(sokvag: string): FlikTillbaka | null {
  const under = (rot: string) => sokvag === rot || sokvag.startsWith(`${rot}/`);
  if (under("/kostnad")) return "kvitton";
  if (under("/projekt")) return "projekt";
  if (under("/export") || under("/forsaljning")) return "deklaration";
  return null;
}

/** Adressen till installningarna fran en sokvag – med ?fran= nar den hor till en flik. */
export function installningarHref(sokvag: string): string {
  const flik = flikForSokvag(sokvag);
  return flik ? `/installningar?fran=${flik}` : "/installningar";
}

/** Bakatlanken pa installningssidan, eller undefined nar ingen ska visas. */
export function tillbakaFranInstallningar(
  fran: string | undefined,
): { href: string; text: string } | undefined {
  if (!fran || !Object.hasOwn(FLIKAR_TILLBAKA, fran)) return undefined;
  return { ...FLIKAR_TILLBAKA[fran as FlikTillbaka] };
}
