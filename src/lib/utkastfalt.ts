// Ett kvittoutkast minns det hon skrev (docs/design.md, "Ett kvittoutkast
// minns det hon skrev"). Formularet skickar sina falt som de star, och de
// tolkas har till de kolumner ett utkast kan bara utan att sluta vara ett.
//
// Beloppet hamnar i `utkast_belopp`, ALDRIG i `totalbelopp`: totalbelopp IS
// NULL ar definitionen av ett utkast (arUtkast), och ett belopp dar skulle
// gora utkastet till ett sparat kvitto utan att hon gjort nagot. De ovriga
// falten ligger i sina vanliga kolumner – ingenting tar dem for tecken pa att
// utkastet ar klart (docs/produktspec.md, datamodellen).
//
// Ingenting valideras mot reglerna har: det gor sparandet, nar hon sparar pa
// riktigt. Ett utkast bar det hon skrivit; ett varde som inte gar att tolka
// som det det ska vara bars inte alls, och ett tomt falt tommer kolumnen –
// utkastet speglar formularet.

import { oreFranKronor } from "@/lib/format";

/** Faltens text som de star i formularet. */
export interface Utkastfalt {
  belopp: string;
  /** YYYY-MM-DD – formularets enda datumfalt, betaldatumet. */
  datum: string;
  /** YYYY-MM-DD – dokumentets eget datum nar avlasningen last ett som skiljer
   *  sig fran betaldatumet, annars "" (= samma dag som betaldatumet). */
  dokumentdatum: string;
  leverantor: string;
  rot: string;
  /** "Vad gällde det?" – det som gor kvittot begripligt om atta ar. */
  anteckning: string;
}

export interface Utkastkolumner {
  utkast_belopp: number | null;
  leverantor: string | null;
  dokumentdatum: Date | null;
  betaldatum: Date | null;
  rot_utnyttjat: number | null;
  anteckning: string | null;
}

/** Postgres int4 – storre varden gar inte att lagra i kolumnerna. */
const STORSTA_INT = 2_147_483_647;

function positivtOreEllerNull(text: string): number | null {
  const ore = oreFranKronor(text);
  return ore !== null && ore > 0 && ore <= STORSTA_INT ? ore : null;
}

function datumEllerNull(text: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const d = new Date(`${text}T00:00:00.000Z`);
  // 2026-02-31 ar inget datum – Date rullar det till mars.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== text ? null : d;
}

export function tolkaUtkastfalt(falt: Utkastfalt): Utkastkolumner {
  const datum = datumEllerNull(String(falt.datum ?? "").trim());
  const dokumentdatum = datumEllerNull(String(falt.dokumentdatum ?? "").trim());
  const leverantor = String(falt.leverantor ?? "").trim();
  // Trimmad som vid sparandet (tolkaKostnadsformular), sa att en blank
  // anteckning ar null och tomt-utkast-regeln ser samma sak som i dag.
  const anteckning = String(falt.anteckning ?? "").trim();
  return {
    utkast_belopp: positivtOreEllerNull(String(falt.belopp ?? "")),
    leverantor: leverantor === "" ? null : leverantor,
    // Faltet ar betaldatumet; dokumentdatumet ar samma dag utom nar
    // avlasningen last ett annat (src/app/kostnad/nytt/form.tsx).
    dokumentdatum: dokumentdatum ?? datum,
    betaldatum: datum,
    rot_utnyttjat: positivtOreEllerNull(String(falt.rot ?? "")),
    anteckning: anteckning === "" ? null : anteckning,
  };
}
