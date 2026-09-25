"use server";

// Bilagor pa en befintlig kostnad: tas bort har, laggs till direkt fran
// webblasaren mot Storage (se src/app/kostnad/bilaga-actions.ts – filen passerar
// aldrig en serverless-funktion). Radering sker bara pa uttrycklig begaran,
// aldrig automatiskt.
//
// Har ligger ocksa redigering och borttagning av sjalva kostnaden (produktspec
// 6.4). Leverantor, datum och ROT gar alltid att andra. Belopp, projektkoppling
// och privatbeloppet gar att andra i SAMMA formular, i ETT enda anrop till
// redigeraKostnad, nar enkelPrivatUppdelning kanner igen radernas form (en
// enda rad, eller den kanoniska tva-radiga privat+ovrigt-uppdelningen) – ett
// genuint flerprojektfall andras per rad via delaUppKostnad (steg 10) istallet.
//
// Privatfaltet ar ETT FALT BLAND DE ANDRA (docs/design.md, "Ett kvitto ar en
// skarm, inte tva"), inte en egen sparning: bade det och de ovriga faltens
// omskrivning av kostnadsraderna sker i SAMMA transaktion i redigeraKostnad.
// Formular far inte nastlas, sa det maste vara sa – tva formular med varsin
// Spara hade lamnat anvandaren med tva knappar for en och samma sak.
//
// Att ta bort kostnaden helt tar med bilagorna, eftersom det ar en uttrycklig
// begaran.
//
// redigeraKostnad REDIRECTAR ALDRIG (docs/design.md, "Ett kvitto ar en skarm,
// inte tva"): redigeringen sker pa plats i andringslaget, sa en lyckad
// sparning bara revalidatePath:ar och returnerar – klienten (kvitto-kort.tsx)
// vaxlar sjalv tillbaka till lasläget via useActionState:s pagar-flagga
// (samma monster som installningar/kort.tsx).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import {
  taBortAllaBilagorForKostnad,
  taBortBilaga,
} from "@/lib/lagring/bilagor";
import { oreFranKronor } from "@/lib/format";
import {
  byggRedigeradeRader,
  enkelPrivatUppdelning,
  tolkaUppdelning,
} from "@/lib/kostnadsuppdelning";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface BilagaResultat {
  ok?: boolean;
  fel?: string;
}

export interface KostnadRedigeraResultat {
  fel?: string;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Undre grans: regelparametrarna seedas med giltig_fran 1970-01-01. En kostnad
// med betaldatum fore dess avvisas har i stallet for att berakningen kastar fel.
const TIDIGASTE_BETALDATUM = "1970-01-01";

const SEK5_FEL =
  "Kvittot har ROT-avdrag eller försäkringsersättning och kan då bara vara " +
  "kopplat till ett projekt. Dela upp fakturan på två kostnader i stället.";

/** Ett belopp som anvandaren kan ha lamnat tomt eller pa noll blir null. */
function positivtEllerNull(varde: number | null): number | null {
  return varde !== null && varde > 0 ? varde : null;
}

function revalideraKostnadsvyer(kostnadId: string): void {
  revalidatePath("/");
  revalidatePath("/kostnad");
  revalidatePath(`/kostnad/${kostnadId}`);
  revalidatePath("/projekt");
  revalidatePath("/projekt/[id]", "page");
  revalidatePath("/export");
}

export async function redigeraKostnad(
  _foreg: KostnadRedigeraResultat,
  formData: FormData,
): Promise<KostnadRedigeraResultat> {
  const { bostadId } = await kravBostad();
  const id = String(formData.get("kostnad_id") ?? "");

  const kostnad = await prisma.kostnad.findFirst({
    where: { id, bostad_id: bostadId },
    include: { rader: { include: { fordelningar: true } } },
  });
  if (!kostnad) return { fel: "Kostnaden hittades inte." };
  if (kostnad.totalbelopp === null) {
    // Ett utkast kompletteras i inmatningsformularet, inte har.
    return { fel: "Kvittot är fortfarande ett utkast. Komplettera det först." };
  }

  const leverantor = String(formData.get("leverantor") ?? "").trim();
  const dokumentdatum = String(formData.get("dokumentdatum") ?? "").trim();
  const betaldatum = String(formData.get("betaldatum") ?? "").trim();
  const projektId = String(formData.get("projekt_id") ?? "").trim();
  // "Vad gällde det?" – samma falt som i inmatningen (produktspec 4.7). Valfri,
  // tom strang blir null precis som vid inmatningen.
  const anteckning = String(formData.get("anteckning") ?? "").trim();

  // ROT-avdraget (docs/design.md, "ROT-avdrag"). Ett enda falt, far lamnas tomt,
  // anges i kronor.
  const rotUtnyttjat = positivtEllerNull(
    oreFranKronor(String(formData.get("rot_utnyttjat") ?? "")),
  );

  if (!leverantor) return { fel: "Fyll i leverantör." };
  if (!DATUM.test(dokumentdatum)) return { fel: "Fyll i kvittots datum." };
  if (betaldatum !== "") {
    if (!DATUM.test(betaldatum)) return { fel: "Betaldatum har fel format." };
    if (betaldatum < TIDIGASTE_BETALDATUM) {
      return { fel: "Betaldatum före 1970 stöds inte." };
    }
  }

  // Ar ROT eller forsakringsersattning satt far kostnaden bara vara kopplad
  // till ett projekt (produktspec 5). En enkel kostnad har alltid hogst ett
  // projekt; en uppdelad kan spanna flera och maste da kontrolleras.
  const antalProjekt = new Set(
    kostnad.rader
      .flatMap((r) => r.fordelningar)
      .filter((f) => !f.privat && f.projekt_id)
      .map((f) => f.projekt_id as string),
  ).size;
  const harAvdragspost =
    rotUtnyttjat !== null || (kostnad.forsakringsersattning ?? 0) > 0;
  if (harAvdragspost && antalProjekt > 1) {
    return { fel: SEK5_FEL };
  }

  const dok = new Date(`${dokumentdatum}T00:00:00.000Z`);
  const bet = betaldatum ? new Date(`${betaldatum}T00:00:00.000Z`) : null;

  const rotFalt = { rot_utnyttjat: rotUtnyttjat };

  // Privatfaltet ar ETT FALT BLAND DE ANDRA i samma formular (docs/design.md,
  // "Ett kvitto ar en skarm, inte tva") – inte en egen sparning. Villkoret ar
  // darfor enkelPrivatUppdelning, INTE arEnkelKostnad: den kanner ocksa igen
  // den kanoniska tva-radiga privat+ovrigt-formen (dar arEnkelKostnad ar
  // false), sa belopp/ROT/projekt/privatbelopp hor ihop som EN grupp som
  // antingen ar hela redigerbar eller hela last – aldrig delad mellan tva
  // formular som inte far nastlas.
  const privatDel = enkelPrivatUppdelning(tillDomanKostnad(kostnad));

  if (!privatDel) {
    // Genuint flerprojektfall: bara leverantor, datum och ROT-faltet andras
    // har. Belopp, projektkoppling och privatbelopp hor till raduppdelningen
    // (delaUppKostnad, steg 10). Totalbeloppet gar darfor INTE att andra i den
    // har grenen (falet visas last i granssnittet) – ROT jamfors darfor mot
    // det SPARADE beloppet, det enda som galler har.
    if (rotUtnyttjat !== null && rotUtnyttjat > kostnad.totalbelopp) {
      return { fel: "ROT-avdraget kan inte vara större än totalbeloppet." };
    }
    await prisma.kostnad.update({
      where: { id },
      data: {
        leverantor,
        dokumentdatum: dok,
        betaldatum: bet,
        anteckning: anteckning || null,
        ...rotFalt,
      },
    });
    revalideraKostnadsvyer(id);
    // Ingen redirect (docs/design.md, "Ett kvitto ar en skarm, inte tva"):
    // sparningen sker pa plats, och klienten vaxlar sjalv tillbaka till
    // lasläget nar useActionState-anropet gar fran pagar till klart.
    return {};
  }

  const totalbelopp = oreFranKronor(String(formData.get("totalbelopp") ?? ""));
  if (totalbelopp === null || totalbelopp <= 0) {
    return { fel: "Fyll i ett belopp större än noll, t.ex. 1 020,95." };
  }
  // ROT jamfors mot det NYSS INSKRIVNA totalbeloppet (bagge i oren), inte det
  // sedan tidigare SPARADE (kostnad.totalbelopp) – en tidigare version gjorde
  // just det, vilket avvisade giltiga sparningar dar bade belopp och ROT
  // hojdes i samma omgang (t.ex. totalbelopp 344 250 kr, ROT 75 000 kr,
  // avvisat nar det gamla sparade beloppet rakade vara mindre an ROT-beloppet).
  if (rotUtnyttjat !== null && rotUtnyttjat > totalbelopp) {
    return { fel: "ROT-avdraget kan inte vara större än totalbeloppet." };
  }

  let kopplatProjekt: string | null = null;
  if (projektId !== "") {
    const projekt = await prisma.projekt.findFirst({
      where: { id: projektId, bostad_id: bostadId },
      select: { id: true },
    });
    if (!projekt) return { fel: "Det valda projektet finns inte." };
    kopplatProjekt = projekt.id;
  }

  // Privatbeloppet (docs/design.md, "Ett kvitto ar en skarm, inte tva"): ett
  // vanligt falt bland de andra, tomt nar inget av kvittot ar privat.
  const privatText = String(formData.get("privatbelopp") ?? "").trim();
  let privatbelopp = 0;
  if (privatText !== "") {
    const parsat = oreFranKronor(privatText);
    if (parsat === null || parsat <= 0) {
      return { fel: "Ange ett privatbelopp större än noll, t.ex. 400." };
    }
    privatbelopp = parsat;
  }

  // byggRedigeradeRader (src/lib/kostnadsuppdelning.ts) ar den enda platsen
  // som bestammer kostnadens rader efter sparningen – bade totalbeloppet/
  // projektkopplingen och privatbeloppet gar genom den, sa de aldrig kan sla
  // ut varandra genom att komma fran tva olika sparningar. `artikel` foljer
  // den "ovriga" (icke-privata) radens namn oavsett om kostnaden i dag ar en
  // enda rad eller redan den tva-radiga privata uppdelningen –
  // enkelPrivatUppdelning har redan hittat ratt rad.
  const nyaRader = byggRedigeradeRader({
    totalbelopp,
    artikel:
      privatDel.ovrigArtikel === kostnad.leverantor
        ? leverantor
        : privatDel.ovrigArtikel,
    projektId: kopplatProjekt,
    privatbelopp,
  });
  if ("fel" in nyaRader) return { fel: nyaRader.fel };

  await prisma.$transaction([
    prisma.kostnad.update({
      where: { id },
      data: {
        leverantor,
        totalbelopp,
        dokumentdatum: dok,
        betaldatum: bet,
        anteckning: anteckning || null,
        ...rotFalt,
      },
    }),
    // Raderna byggs om fran grunden – enklast och kan inte glida isar, precis
    // som delaUppKostnad gor.
    prisma.kostnadsrad.deleteMany({ where: { kostnad_id: id } }),
    ...nyaRader.rader.map((rad) =>
      prisma.kostnadsrad.create({
        data: {
          kostnad_id: id,
          artikel: rad.artikel,
          belopp: rad.belopp,
          fordelningar: rad.fordelningar.length
            ? {
                create: rad.fordelningar.map((f) => ({
                  projekt_id: f.projekt_id,
                  privat: f.privat,
                  andel: f.andel,
                })),
              }
            : undefined,
        },
      }),
    ),
  ]);

  revalideraKostnadsvyer(id);
  // Ingen redirect har heller – se kommentaren i grenen ovan.
  return {};
}

// Steg 10: dela upp ett kvitto pa radniva. Varje rad far en artikel, ett belopp
// och ett mal (ett projekt, "privat" eller okopplat). Summan av radernas belopp
// maste vara lika med kostnadens totalbelopp – valideras i tolkaUppdelning
// tillsammans med ovriga invarianter. Raderna byggs om fran grunden i en
// transaktion; det ar enklast och kan inte glida isar.
export async function delaUppKostnad(
  _foreg: KostnadRedigeraResultat,
  formData: FormData,
): Promise<KostnadRedigeraResultat> {
  const { bostadId } = await kravBostad();
  const id = String(formData.get("kostnad_id") ?? "");

  const kostnad = await prisma.kostnad.findFirst({
    where: { id, bostad_id: bostadId },
    select: {
      id: true,
      totalbelopp: true,
      rot_utnyttjat: true,
      forsakringsersattning: true,
    },
  });
  if (!kostnad) return { fel: "Kostnaden hittades inte." };
  if (kostnad.totalbelopp === null) {
    return { fel: "Kvittot är fortfarande ett utkast. Komplettera det först." };
  }

  const artiklar = formData.getAll("artikel").map(String);
  const belopp = formData.getAll("belopp").map(String);
  const mal = formData.getAll("mal").map(String);
  const andelar = formData.getAll("andel").map(String);

  const indata = artiklar.map((artikel, i) => ({
    artikel,
    belopp: belopp[i] ?? "",
    mal: mal[i] ?? "",
    andel: andelar[i] ?? "",
  }));

  // ROT och forsakringsersattning ligger pa kostnadsniva men fordelas
  // proportionellt over raderna (produktspec 4.2). Da maste raderna hallas till
  // ett enda projekt, annars blir reduktionen inte entydig.
  const endastEttProjekt =
    (kostnad.rot_utnyttjat ?? 0) > 0 ||
    (kostnad.forsakringsersattning ?? 0) > 0;

  const tolkad = tolkaUppdelning(indata, kostnad.totalbelopp, {
    endastEttProjekt,
  });
  if ("fel" in tolkad) return { fel: tolkad.fel };

  if (tolkad.projektIder.length > 0) {
    const funna = await prisma.projekt.findMany({
      where: { id: { in: tolkad.projektIder }, bostad_id: bostadId },
      select: { id: true },
    });
    if (funna.length !== tolkad.projektIder.length) {
      return { fel: "Ett av de valda projekten finns inte." };
    }
  }

  await prisma.$transaction([
    prisma.kostnadsrad.deleteMany({ where: { kostnad_id: id } }),
    ...tolkad.rader.map((rad) =>
      prisma.kostnadsrad.create({
        data: {
          kostnad_id: id,
          artikel: rad.artikel,
          belopp: rad.belopp,
          fordelningar: rad.fordelningar.length
            ? {
                create: rad.fordelningar.map((f) => ({
                  projekt_id: f.projekt_id,
                  privat: f.privat,
                  andel: f.andel,
                })),
              }
            : undefined,
        },
      }),
    ),
  ]);

  revalideraKostnadsvyer(id);
  redirect(`/kostnad/${id}`);
}

// Ett kvitto som hamnat i "Raknas inte med" (arkiverad) foras tillbaka till
// klassificeringsgenomgangen. Ordet "arkiverad" visas aldrig for anvandaren.
export async function aterforTillGenomgang(formData: FormData): Promise<void> {
  const { bostadId } = await kravBostad();
  const id = String(formData.get("kostnad_id") ?? "");

  await prisma.kostnad.updateMany({
    where: { id, bostad_id: bostadId },
    data: { arkiverad: false },
  });

  revalideraKostnadsvyer(id);
  revalidatePath("/genomgang");
  redirect(`/kostnad/${id}`);
}

// Delad raderingslogik för taBortKostnad och taBortUtkastRad nedan – bara
// navigeringen skiljer dem åt (docs/design.md, "Listrader": "En åtgärd på en
// rad byter aldrig sida").
async function taBortKostnadIntern(
  id: string,
  bostadId: string,
  anvandareId: string,
): Promise<KostnadRedigeraResultat> {
  const kostnad = await prisma.kostnad.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true },
  });
  if (!kostnad) return { fel: "Kostnaden hittades inte." };

  // Bilagorna tas bort med kostnaden – uttrycklig begaran fran anvandaren.
  // Storage rensas forst; kostnadsraderna, fordelningarna och kvarvarande
  // bilaga-rader far cascaden ta.
  const bilagor = await taBortAllaBilagorForKostnad(id, anvandareId);
  if (!bilagor.ok) {
    return { fel: bilagor.fel ?? "Kunde inte ta bort bilagorna." };
  }

  await prisma.kostnad.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/kostnad");
  revalidatePath("/projekt");
  revalidatePath("/projekt/[id]", "page");
  revalidatePath("/export");
  return {};
}

// Anvands nar borttagningen ar den ENDA sak sidan visade – "Ta bort kvittot" i
// redigeringsvyn, och UtkastRaderaKnapp i "knapp"-lage langst ned i
// kompletteringsformularet (produktspec 6.4). Dar finns inget kvar att visa
// nar posten ar borta, sa ett redirect till listan ar ratt.
export async function taBortKostnad(
  _foreg: KostnadRedigeraResultat,
  formData: FormData,
): Promise<KostnadRedigeraResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  const id = String(formData.get("kostnad_id") ?? "");

  const resultat = await taBortKostnadIntern(id, bostadId, anvandareId);
  if (resultat.fel) return resultat;
  redirect("/kostnad");
}

// Radering av ett utkast SOM EN RAD I EN LISTA – kvittolistan och oversikten
// (docs/design.md, "Listrader": "En åtgärd på en rad byter aldrig sida").
// UtkastRaderaKnapp i "ikon"-lage anvander den har i stallet for taBortKostnad
// ovan: den navigerar ALDRIG, bara uppdaterar (revalidatePath racker – sidan
// man redan star pa laddar om sig sjalv), sa att man blir kvar dar man var,
// med sin plats i listan behallen, oavsett vilken lista knappen ligger i.
export async function taBortUtkastRad(
  _foreg: KostnadRedigeraResultat,
  formData: FormData,
): Promise<KostnadRedigeraResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  const id = String(formData.get("kostnad_id") ?? "");
  return taBortKostnadIntern(id, bostadId, anvandareId);
}

// Uppladdning av bilagor till en befintlig kostnad gors nu direkt fran
// webblasaren mot Storage via de signerade URL:erna i
// src/app/kostnad/bilaga-actions.ts. Efter bekraftad uppladdning kallar
// klienten revalideraKostnadssida for att ladda om bilageraden.
export async function revalideraKostnadssida(kostnadId: string): Promise<void> {
  await kravBostad();
  revalidatePath(`/kostnad/${kostnadId}`);
}

export async function taBortBilagaAction(
  _foreg: BilagaResultat,
  formData: FormData,
): Promise<BilagaResultat> {
  const { anvandareId } = await kravBostad();
  const bilagaId = String(formData.get("bilaga_id") ?? "");
  const kostnadId = String(formData.get("kostnad_id") ?? "");

  const resultat = await taBortBilaga(bilagaId, anvandareId);
  if (!resultat.ok) {
    return { fel: resultat.fel ?? "Kunde inte ta bort bilagan." };
  }

  revalidatePath(`/kostnad/${kostnadId}`);
  return { ok: true };
}
