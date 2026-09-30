// Inbjudan till en bostad (docs/design.md, "Att bjuda in en delagare").
//
// Inbjudan ger tillgang till ett arkiv, ingenting annat: ingen andel, inget
// tilltradesdatum, inget om vem som deklarerar vad. Det fragas nar bostaden
// markeras som sald.
//
// Inbjudan ar en POST, inte en lank. Adressen binder den: den kan bara losas in
// av nagon som ar inloggad med exakt den adressen. Id:t i lanken och QR-koden
// pekar bara ut vilken post det galler – den som hittar lanken kan inte gora
// nagot med den. Det ar hela sakerhetsmodellen.
//
// Anroparen (serveratgarderna i src/app/inbjudan/actions.ts) star for vem som
// ar inloggad och i vilken bostad; funktionerna har tar det som argument.

import "server-only";
import { Prisma } from "@prisma/client";
import { agarandelFel, agarandelFranText } from "@/lib/agarandel";
import { allaAndelar, hamtaAndelar } from "@/lib/andelar";
import { prisma } from "@/lib/prisma";
import { andelssummaVidInbjudan, summeraAndelar } from "@/lib/samagande";

const EPOST = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Adresser jamfors alltid trimmade och i gemener, aldrig som de skrevs. */
export function normaliseraEpost(epost: string): string {
  return epost.trim().toLowerCase();
}

/** Finns ett konto med adressen? Bara for att informera – det forgrenar ingenting. */
async function harKonto(epost: string): Promise<boolean> {
  const rad = await prisma.anvandare.findFirst({
    where: { epost: { equals: epost, mode: "insensitive" } },
    select: { id: true },
  });
  return rad !== null;
}

export type SkapaInbjudanResultat =
  | { ok: true; inbjudanId: string; epost: string; harKonto: boolean }
  | { ok: false; fel: string };

/**
 * Skapar en inbjudan och satter bada andelarna (docs/design.md, "Att bjuda in
 * en delagare"). Den som bjuder in star pa standardvardet 100 %, sa ett steg
 * som bara fragade efter den inbjudnas andel kunde inte ge henne nagot utan
 * att summan sprangde 100 %. Den egna andelen sparas nu; den inbjudnas skrivs
 * pa inbjudan och blir medlemskapets nar den loses in.
 *
 * Summan provas har, pa servern, i samma transaktion som skrivningarna: alla
 * medlemmar, alla andra utestaende inbjudningar och den nya. Den far inte
 * overstiga 100 %. Den far garna vara under.
 */
export async function skapaInbjudan(params: {
  bostadId: string;
  anvandareId: string;
  anvandarEpost: string;
  epost: string;
  /** Den som bjuder ins egen andel, som text ur faltet. Tomt = hela bostaden. */
  egenAndel: string;
  /** Den inbjudnas andel, som text ur faltet. Maste anges. */
  inbjudenAndel: string;
}): Promise<SkapaInbjudanResultat> {
  const epost = normaliseraEpost(params.epost);
  if (!EPOST.test(epost)) return { ok: false, fel: "Fyll i en giltig e-postadress." };
  if (epost === normaliseraEpost(params.anvandarEpost)) {
    return { ok: false, fel: "Det är din egen adress." };
  }

  const egen = agarandelFranText(params.egenAndel);
  if (egen === undefined) return { ok: false, fel: `Din andel: ${agarandelFel(params.egenAndel)}` };
  if (params.inbjudenAndel.trim() === "") {
    return { ok: false, fel: "Ange andelen för den du bjuder in." };
  }
  const inbjuden = agarandelFranText(params.inbjudenAndel);
  if (inbjuden === undefined) {
    return { ok: false, fel: `Den inbjudnas andel: ${agarandelFel(params.inbjudenAndel)}` };
  }

  const resultat = await prisma.$transaction(
    async (tx): Promise<{ ok: true; inbjudanId: string } | { ok: false; fel: string }> => {
      const redanMedlem = await tx.medlemskap.findFirst({
        where: {
          bostad_id: params.bostadId,
          anvandare: { epost: { equals: epost, mode: "insensitive" } },
        },
        select: { id: true },
      });
      if (redanMedlem) return { ok: false, fel: "Den adressen har redan tillgång till bostaden." };

      // Summan efter inbjudan: den egna andelen byts mot den nya, och en
      // utestaende inbjudan till samma adress ersatts av den har.
      const andelar = await hamtaAndelar(params.bostadId, tx);
      const ovriga = allaAndelar({
        medlemmar: andelar.medlemmar.filter((m) => m.anvandareId !== params.anvandareId),
        inbjudningar: andelar.inbjudningar.filter((i) => i.epost !== epost),
      });
      const fel = andelssummaVidInbjudan(summeraAndelar([...ovriga, egen, inbjuden]));
      if (fel) return { ok: false, fel };

      await tx.medlemskap.updateMany({
        where: { anvandare_id: params.anvandareId, bostad_id: params.bostadId },
        data: { agarandel: egen },
      });

      // En utestaende inbjudan till samma adress ateranvands i stallet for att
      // en till skapas – ett dubbelklick eller ett nytt forsok ger samma kod,
      // med den senast angivna andelen.
      const befintlig = await tx.inbjudan.findFirst({
        where: { bostad_id: params.bostadId, epost, status: "utestaende" },
        select: { id: true },
      });
      if (befintlig) {
        await tx.inbjudan.update({ where: { id: befintlig.id }, data: { agarandel: inbjuden } });
        return { ok: true, inbjudanId: befintlig.id };
      }
      const ny = await tx.inbjudan.create({
        data: { bostad_id: params.bostadId, epost, inbjuden_av: params.anvandareId, agarandel: inbjuden },
        select: { id: true },
      });
      return { ok: true, inbjudanId: ny.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (!resultat.ok) return resultat;

  return { ok: true, inbjudanId: resultat.inbjudanId, epost, harKonto: await harKonto(epost) };
}

/** Aterkallar en utestaende inbjudan i bostaden. Ror aldrig en annan bostads. */
export async function aterkallaInbjudan(params: {
  bostadId: string;
  inbjudanId: string;
}): Promise<{ ok: boolean }> {
  const { count } = await prisma.inbjudan.updateMany({
    where: { id: params.inbjudanId, bostad_id: params.bostadId, status: "utestaende" },
    data: { status: "aterkallad", besvarad_at: new Date() },
  });
  return { ok: count === 1 };
}

export interface Inbjudningsvy {
  id: string;
  epost: string;
  status: "utestaende" | "accepterad" | "aterkallad";
  inbjudarEpost: string | null;
  bostadsnamn: string;
}

function bostadsnamn(b: { namn: string | null; adress: string | null }): string {
  return b.namn?.trim() || b.adress?.trim() || "en bostad";
}

/**
 * Det sidan bakom koden visar innan det finns ett falt att fylla i: vem som
 * bjudit in, vilken bostad, och till vilken adress. Null om id:t inte finns.
 */
export async function hamtaInbjudningsvy(inbjudanId: string): Promise<Inbjudningsvy | null> {
  if (!UUID.test(inbjudanId)) return null;
  const rad = await prisma.inbjudan.findUnique({
    where: { id: inbjudanId },
    select: {
      id: true,
      epost: true,
      status: true,
      inbjudare: { select: { epost: true } },
      bostad: { select: { namn: true, adress: true } },
    },
  });
  if (!rad) return null;
  return {
    id: rad.id,
    epost: rad.epost,
    status: rad.status,
    inbjudarEpost: rad.inbjudare?.epost ?? null,
    bostadsnamn: bostadsnamn(rad.bostad),
  };
}

/** Har adressen ett konto? Avgors nar sidan oppnas, aldrig nar koden skapas. */
export async function inbjudenHarKonto(epost: string): Promise<boolean> {
  return harKonto(normaliseraEpost(epost));
}

/** Utestaende inbjudningar till en adress – for startskarmen och registreringen. */
export async function utestaendeInbjudningar(epost: string): Promise<Inbjudningsvy[]> {
  const rader = await prisma.inbjudan.findMany({
    where: { epost: normaliseraEpost(epost), status: "utestaende" },
    orderBy: { skapad_at: "asc" },
    select: {
      id: true,
      epost: true,
      status: true,
      inbjudare: { select: { epost: true } },
      bostad: { select: { namn: true, adress: true } },
    },
  });
  return rader.map((r) => ({
    id: r.id,
    epost: r.epost,
    status: r.status,
    inbjudarEpost: r.inbjudare?.epost ?? null,
    bostadsnamn: bostadsnamn(r.bostad),
  }));
}

export type InlosenFel = "finns_inte" | "aterkallad" | "redan_inlost" | "fel_adress" | "har_bostad";

export type InlosenResultat = { ok: true; bostadId: string } | { ok: false; fel: InlosenFel };

class Avbruten extends Error {
  constructor(public fel: InlosenFel) {
    super(fel);
  }
}

/**
 * Loser in en inbjudan: ger den inloggade medlemskap i bostaden. Bara den som
 * ar inloggad med exakt adressen inbjudan stallts till kan gora det. Den som
 * redan har en bostad blockeras och inbjudan ligger kvar – ingen bostad tas
 * bort. Status och medlemskap andras i samma transaktion, och statusbytet
 * provar att inbjudan fortfarande ar utestaende: samma inbjudan kan inte
 * losas in tva ganger.
 */
export async function losInInbjudan(params: {
  inbjudanId: string;
  anvandareId: string;
  anvandarEpost: string;
}): Promise<InlosenResultat> {
  if (!UUID.test(params.inbjudanId)) return { ok: false, fel: "finns_inte" };
  try {
    const bostadId = await prisma.$transaction(
      async (tx) => {
        const inbjudan = await tx.inbjudan.findUnique({
          where: { id: params.inbjudanId },
          select: { bostad_id: true, epost: true, status: true, agarandel: true },
        });
        if (!inbjudan) throw new Avbruten("finns_inte");
        if (inbjudan.status === "aterkallad") throw new Avbruten("aterkallad");
        if (inbjudan.status === "accepterad") throw new Avbruten("redan_inlost");
        if (normaliseraEpost(inbjudan.epost) !== normaliseraEpost(params.anvandarEpost)) {
          throw new Avbruten("fel_adress");
        }

        const befintligt = await tx.medlemskap.findFirst({
          where: { anvandare_id: params.anvandareId },
          select: { id: true },
        });
        if (befintligt) throw new Avbruten("har_bostad");

        const { count } = await tx.inbjudan.updateMany({
          where: { id: params.inbjudanId, status: "utestaende" },
          data: { status: "accepterad", besvarad_at: new Date() },
        });
        if (count !== 1) throw new Avbruten("redan_inlost");

        // Andelen den som bjod in angav blir medlemskapets. Ett utgangsvarde,
        // bekraftat nar bostaden markeras som sald. En inbjudan fran innan
        // andelen fragades har ingen och ger schemats standardvarde.
        await tx.medlemskap.create({
          data: {
            anvandare_id: params.anvandareId,
            bostad_id: inbjudan.bostad_id,
            ...(inbjudan.agarandel !== null ? { agarandel: inbjudan.agarandel } : {}),
          },
        });
        return inbjudan.bostad_id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { ok: true, bostadId };
  } catch (fel) {
    if (fel instanceof Avbruten) return { ok: false, fel: fel.fel };
    throw fel;
  }
}

/** Beskedet for varje skal att en inbjudan inte gick att losa in. */
export function inlosenFeltext(fel: InlosenFel, inbjudenEpost?: string): string {
  switch (fel) {
    case "finns_inte":
      return "Inbjudan finns inte. Kontrollera länken, eller be om en ny.";
    case "aterkallad":
      return "Inbjudan är återkallad. Be den som bjöd in dig om en ny.";
    case "redan_inlost":
      return "Inbjudan är redan använd.";
    case "fel_adress":
      return inbjudenEpost
        ? `Inbjudan gäller ${inbjudenEpost}, men du är inloggad med en annan adress. Logga ut och logga in med ${inbjudenEpost}.`
        : "Inbjudan gäller en annan e-postadress än den du är inloggad med.";
    case "har_bostad":
      return "Du har redan en bostad i appen, och appen hanterar en bostad per person i dag. Inbjudan ligger kvar på startsidan och går att acceptera den dag det går att växla mellan bostäder.";
  }
}
