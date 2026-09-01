"use server";

// Bilagor pa en befintlig kostnad: lagg till och ta bort. Uppladdningen
// bekraftas mot Storage innan resultatet returneras (produktspec 12) – vid fel
// slapper klienten aldrig filen ur input-faltet. Radering sker bara pa
// uttrycklig begaran, aldrig automatiskt.
//
// Har ligger ocksa redigering och borttagning av sjalva kostnaden (produktspec
// 6.4). Leverantor och datum gar alltid att andra; belopp och projektkoppling
// bara nar kostnaden ar "enkel" (en rad pa hela beloppet, hogst en fordelning) –
// en uppdelad kostnad andras per rad, vilket hor till ett senare steg. Att ta
// bort kostnaden helt tar med bilagorna, eftersom det ar en uttrycklig begaran.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { arEnkelKostnad } from "@/doman/berakningar";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import {
  laddaUppKostnadsbilaga,
  taBortAllaBilagorForKostnad,
  taBortBilaga,
} from "@/lib/lagring/bilagor";
import { oreFranKronor } from "@/lib/format";
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

  const leverantor = String(formData.get("leverantor") ?? "").trim();
  const dokumentdatum = String(formData.get("dokumentdatum") ?? "").trim();
  const betaldatum = String(formData.get("betaldatum") ?? "").trim();
  const projektId = String(formData.get("projekt_id") ?? "").trim();

  if (!leverantor) return { fel: "Fyll i leverantör." };
  if (!DATUM.test(dokumentdatum)) return { fel: "Fyll i kvittots datum." };
  if (betaldatum !== "") {
    if (!DATUM.test(betaldatum)) return { fel: "Betaldatum har fel format." };
    if (betaldatum < TIDIGASTE_BETALDATUM) {
      return { fel: "Betaldatum före 1970 stöds inte." };
    }
  }

  const dok = new Date(`${dokumentdatum}T00:00:00.000Z`);
  const bet = betaldatum ? new Date(`${betaldatum}T00:00:00.000Z`) : null;

  const enkel = arEnkelKostnad(tillDomanKostnad(kostnad));

  if (!enkel) {
    // Uppdelad kostnad: bara leverantor och datum andras har. Belopp och
    // koppling hor till raduppdelningen (senare steg).
    await prisma.kostnad.update({
      where: { id },
      data: { leverantor, dokumentdatum: dok, betaldatum: bet },
    });
    revalideraKostnadsvyer(id);
    redirect(`/kostnad/${id}`);
  }

  const totalbelopp = oreFranKronor(String(formData.get("totalbelopp") ?? ""));
  if (totalbelopp === null || totalbelopp <= 0) {
    return { fel: "Fyll i ett belopp större än noll, t.ex. 1 020,95." };
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
  const nyArtikel = rad.artikel === kostnad.leverantor ? leverantor : rad.artikel;

  await prisma.$transaction([
    prisma.kostnad.update({
      where: { id },
      data: { leverantor, totalbelopp, dokumentdatum: dok, betaldatum: bet },
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

export async function laddaUppBilagor(
  _foreg: BilagaResultat,
  formData: FormData,
): Promise<BilagaResultat> {
  const { bostadId } = await kravBostad();
  const kostnadId = String(formData.get("kostnad_id") ?? "");

  const kostnad = await prisma.kostnad.findFirst({
    where: { id: kostnadId, bostad_id: bostadId },
    select: { id: true },
  });
  if (!kostnad) return { fel: "Kostnaden hittades inte." };

  const filer = formData
    .getAll("bilagor")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (filer.length === 0) return { fel: "Välj minst en fil att ladda upp." };

  for (const fil of filer) {
    const resultat = await laddaUppKostnadsbilaga({
      bostadId,
      kostnadId,
      fil,
    });
    if (!resultat.ok) {
      return {
        fel: `${fil.name || "Filen"}: ${resultat.fel ?? "uppladdningen misslyckades."}`,
      };
    }
  }

  revalidatePath(`/kostnad/${kostnadId}`);
  return { ok: true };
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
