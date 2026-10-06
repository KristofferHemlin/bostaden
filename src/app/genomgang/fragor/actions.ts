"use server";

// Klassificeringsgenomgangen, fas 2: for varje hog stalls fragetradet EN gang
// (produktspec 4.1, 6.2, "Klassificeringsgenomgangen"). Det ar forst har
// skatteterminologin blir relevant – da har anvandaren redan bestamt vad hogen
// ar i fas 1.
//
// En hog ar ett projekt med atgardstyp = null. `klassificeraHog` satter
// atgardstyp (m.fl. svar via tolkaFragetradetFormData – samma tolkning som
// projektets redigering anvander); darefter faller hogen ur fas 2:s lista.
// Redan klassificerade hogar ror vi inte har – de andras via projektets
// vanliga redigering (produktspec 6.4).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serverfelMeddelande } from "@/lib/databas-fel";
import {
  bostadsfragornaBesvarade,
  FEL_FORSTA_AGARE,
  lagringAvBostadsfragor,
  tolkaBostadsfragesvar,
} from "@/doman/bostadsfragor";
import { kravBostadsfragorBesvarade } from "@/lib/bostadsfragor-sparr";
import { tolkaFragetradetFormData } from "@/lib/fragetradet-formdata";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface FragorResultat {
  fel?: string;
}

export async function klassificeraHog(
  _foreg: FragorResultat,
  formData: FormData,
): Promise<FragorResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  await kravBostadsfragorBesvarade(bostadId);

  const projektId = String(formData.get("projekt_id") ?? "");

  const tolkat = tolkaFragetradetFormData(formData);
  if ("fel" in tolkat) return tolkat;

  try {
    const projekt = await prisma.projekt.findFirst({
      where: { id: projektId, bostad_id: bostadId },
      select: { id: true, atgardstyp: true, ar: true },
    });
    if (!projekt) return { fel: "Projektet hittades inte." };
    if (projekt.atgardstyp !== null) {
      return { fel: "Frågorna om det här projektet är redan besvarade." };
    }

    // Ar-etiketten sätts om till tidigaste betaldatum bland hogens kvitton, sa att
    // den stammer med det som faktiskt raknas. Allt som avgor tröskel och
    // femarsfonster utgar anda fran kostnadernas betaldatum, inte fran denna.
    const kopplade = await prisma.kostnad.findMany({
      where: {
        bostad_id: bostadId,
        betaldatum: { not: null },
        rader: { some: { fordelningar: { some: { projekt_id: projektId } } } },
      },
      select: { betaldatum: true },
    });
    const arKandidater = kopplade
      .map((k) => k.betaldatum?.getUTCFullYear())
      .filter((v): v is number => v !== undefined);
    const nyttAr =
      arKandidater.length > 0 ? Math.min(...arKandidater) : projekt.ar;

    await prisma.projekt.update({
      where: { id: projektId },
      data: {
        namn: tolkat.namn,
        ar: nyttAr,
        atgardstyp: tolkat.atgardstyp,
        battre_kvalitet: tolkat.battre_kvalitet,
        merkostnad: tolkat.merkostnad,
        skick_forvarv: tolkat.skick_forvarv,
        motivering: tolkat.motivering,
        klassificerad_av: anvandareId,
      },
    });
  } catch (fel) {
    return {
      fel: serverfelMeddelande(fel, { sida: "genomgang/fragor", anrop: "klassificeraHog", anvandareId }),
    };
  }

  revalidatePath("/");
  revalidatePath("/genomgang");
  revalidatePath("/genomgang/fragor");
  revalidatePath("/projekt");
  revalidatePath("/projekt/[id]", "page");
  revalidatePath("/kostnad");
  revalidatePath("/export");
  redirect("/genomgang/fragor");
}

// Bostadsfragorna (produktspec 4.1, 4.6) – forsta agaren, och for en
// bostadsratt med ja aven ombildningen (src/doman/bostadsfragor.ts). Stalls
// EN gang per bostad, som ett steg innan forsta hogen klassificeras – aldrig
// per atgard. Blockerar genomgangen tills de ar besvarade, eftersom
// reparationsdelen annars inte gar att rakna. Gar att andra i
// installningarna efterat (se installningar/actions.ts), som satter
// bostadsfragor_besvarade efter samma villkor – och nollstaller den nar
// upplatelseformen byts. Flaggan rors aldrig i klassificeringen av en
// enskild hog.

export interface BostadsfragorResultat {
  fel?: string;
}

export async function sparaBostadsfragor(
  _foreg: BostadsfragorResultat,
  formData: FormData,
): Promise<BostadsfragorResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  // Tolkning och villkor delas med installningarna (src/doman/bostadsfragor.ts).
  // Upplatelseformen avgor om ombildningsfragan stalls, och lases fran
  // bostaden – aldrig fran formularet.
  const { upplatelseform } = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { upplatelseform: true },
  });
  const tolkat = tolkaBostadsfragesvar(
    String(formData.get("forsta_agare") ?? ""),
    String(formData.get("ombildning") ?? ""),
    upplatelseform,
  );
  if ("fel" in tolkat) return tolkat;
  if (!bostadsfragornaBesvarade(tolkat.svar)) return { fel: FEL_FORSTA_AGARE };

  try {
    await prisma.bostad.update({
      where: { id: bostadId },
      data: lagringAvBostadsfragor(tolkat.svar),
    });
  } catch (fel) {
    return {
      fel: serverfelMeddelande(fel, {
        sida: "genomgang/fragor",
        anrop: "sparaBostadsfragor",
        anvandareId,
      }),
    };
  }

  revalidatePath("/genomgang");
  revalidatePath("/genomgang/fragor");
  revalidatePath("/installningar");
  revalidatePath("/export");

  // Produktspec 4.1, "Efter frågorna hamnar man i grupperingen, oavsett
  // vilken ingång som utlöste grinden": den som just svarat forsta gangen
  // har per definition inget grupperat, sa standard ar grupperingen –
  // fas 2 skulle bara mota hen med "Inget mer att klassificera". Undantaget
  // ar ingangen fran ett enskilt projekts "Klassificera hogen"
  // (bostadsfragor.tsx skickar da med nasta="/genomgang/fragor"), dar nagot
  // faktiskt finns att klassificera. Whitelistad – `nasta` ar anvandarstyrd
  // formdata, och ett ovaliderat varde hade varit en open redirect.
  const nasta = formData.get("nasta");
  redirect(nasta === "/genomgang/fragor" ? "/genomgang/fragor" : "/genomgang");
}
