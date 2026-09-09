"use server";

// Bilagor pa en befintlig kostnad: tas bort har, laggs till direkt fran
// webblasaren mot Storage (se src/app/kostnad/bilaga-actions.ts – filen passerar
// aldrig en serverless-funktion). Radering sker bara pa uttrycklig begaran,
// aldrig automatiskt.
//
// Har ligger ocksa redigering och borttagning av sjalva kostnaden (produktspec
// 6.4). Leverantor och datum gar alltid att andra; belopp och projektkoppling
// bara nar kostnaden ar "enkel" (en rad pa hela beloppet, hogst en fordelning) –
// en uppdelad kostnad andras per rad via delaUppKostnad (steg 10). Att ta bort
// kostnaden helt tar med bilagorna, eftersom det ar en uttrycklig begaran.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { arEnkelKostnad } from "@/doman/berakningar";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import {
  taBortAllaBilagorForKostnad,
  taBortBilaga,
} from "@/lib/lagring/bilagor";
import { oreFranKronor } from "@/lib/format";
import { tolkaUppdelning } from "@/lib/kostnadsuppdelning";
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

  // ROT-beloppet ar en del av totalbeloppet – ett varde over det ar en
  // felskrivning.
  if (rotUtnyttjat !== null && rotUtnyttjat > kostnad.totalbelopp) {
    return { fel: "ROT-avdraget kan inte vara större än totalbeloppet." };
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

  const enkel = arEnkelKostnad(tillDomanKostnad(kostnad));

  if (!enkel) {
    // Uppdelad kostnad: bara leverantor, datum och ROT-faltet andras har.
    // Belopp och koppling hor till raduppdelningen (senare steg).
    await prisma.kostnad.update({
      where: { id },
      data: { leverantor, dokumentdatum: dok, betaldatum: bet, ...rotFalt },
    });
    revalideraKostnadsvyer(id);
    redirect(`/kostnad/${id}`);
  }

  const totalbelopp = oreFranKronor(String(formData.get("totalbelopp") ?? ""));
  if (totalbelopp === null || totalbelopp <= 0) {
    return { fel: "Fyll i ett belopp större än noll, t.ex. 1 020,95." };
  }
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

  const rad = kostnad.rader[0];
  const nyArtikel =
    rad.artikel === kostnad.leverantor ? leverantor : rad.artikel;

  await prisma.$transaction([
    prisma.kostnad.update({
      where: { id },
      data: {
        leverantor,
        totalbelopp,
        dokumentdatum: dok,
        betaldatum: bet,
        ...rotFalt,
      },
    }),
    prisma.kostnadsrad.update({
      where: { id: rad.id },
      data: { belopp: totalbelopp, artikel: nyArtikel },
    }),
    // Fordelningen byggs om fran grunden: enklast och kan inte glida isar.
    prisma.radfordelning.deleteMany({ where: { kostnadsrad_id: rad.id } }),
    ...(kopplatProjekt
      ? [
          prisma.radfordelning.create({
            data: {
              kostnadsrad_id: rad.id,
              projekt_id: kopplatProjekt,
              privat: false,
              andel: 1,
            },
          }),
        ]
      : []),
  ]);

  revalideraKostnadsvyer(id);
  redirect(`/kostnad/${id}`);
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

export async function taBortKostnad(
  _foreg: KostnadRedigeraResultat,
  formData: FormData,
): Promise<KostnadRedigeraResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  const id = String(formData.get("kostnad_id") ?? "");

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
  redirect("/kostnad");
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
