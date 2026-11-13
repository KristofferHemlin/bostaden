"use server";

// "Lägg till kvitton" pa ett projekt som redan finns (docs/design.md, "Att
// lägga kvitton till ett projekt som redan finns"): flera kvitton i ett svep,
// med samma koppling som projektskapandet (src/lib/kvittokoppling.ts).
//
// Merkostnaden: ett projekt sparat som battre kvalitet utan belopp vantar pa
// fragan (docs/design.md, "Att skapa ett projekt"). Far projektet ett belopp
// har blir fragan aktuell i samma stund – och stalls har, i samma
// formular, i stallet for att lamnas till en upplysning hon kanske aldrig
// laser. Spärren 0 < merkostnad < belopp galler, mot projektets nya belopp.
// Far projektet inget belopp (bara obetalda kvitton) vantar fragan vidare.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beloppOmKopplade, kvittoGarAttKoppla, merkostnadFragasVid } from "@/doman/kvittokoppling";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { hamtaProjektetsBelopp, tillDomanKostnad } from "@/lib/doman-fran-db";
import { provaMerkostnad } from "@/lib/fragetradet-formdata";
import { oreFranKronor } from "@/lib/format";
import { arGiltigtId } from "@/lib/giltigt-id";
import { kopplaKvittonTillProjekt } from "@/lib/kvittokoppling";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface LaggTillKvittonResultat {
  fel?: string;
  falt?: "kvitton" | "merkostnad";
}

/** Ett valt kvitto hann kopplas nagon annanstans medan hon valde. */
class KvittonaHannAndras extends Error {}

export async function laggTillKvitton(
  _foreg: LaggTillKvittonResultat,
  formData: FormData,
): Promise<LaggTillKvittonResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  const id = String(formData.get("projekt_id") ?? "");
  if (!arGiltigtId(id)) return { fel: "Projektet hittades inte." };

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true, namn: true, atgardstyp: true, battre_kvalitet: true, merkostnad: true },
  });
  if (!projekt) return { fel: "Projektet hittades inte." };

  const kostnadIder = [
    ...new Set(formData.getAll("kostnad_ider").map(String).filter(arGiltigtId)),
  ];
  if (kostnadIder.length === 0) return { fel: "Välj minst ett kvitto.", falt: "kvitton" };

  const valda = (
    await prisma.kostnad.findMany({
      where: { id: { in: kostnadIder }, bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
    })
  ).filter((k) => kvittoGarAttKoppla(tillDomanKostnad(k)));

  const beloppEfter =
    (await hamtaProjektetsBelopp(bostadId, id)) + beloppOmKopplade(valda.map(tillDomanKostnad));
  const fragas = merkostnadFragasVid(projekt, beloppEfter);
  let merkostnad: number | null = null;
  if (fragas) {
    merkostnad = oreFranKronor(String(formData.get("merkostnad") ?? ""));
    const fel = provaMerkostnad(merkostnad, beloppEfter, projekt.namn);
    if (fel) return { fel, falt: "merkostnad" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const kopplade = await kopplaKvittonTillProjekt(tx, bostadId, id, valda.map((k) => k.id));
      // Beloppet ovan – och merkostnadens grans – raknades pa just de har
      // kvittona. Hann nagot kopplas nagon annanstans sparas ingenting.
      if (kopplade.length !== valda.length || valda.length === 0) throw new KvittonaHannAndras();
      if (fragas) {
        await tx.projekt.update({
          where: { id },
          data: { merkostnad, merkostnad_bas: beloppEfter, klassificerad_av: anvandareId },
        });
      }
    });
  } catch (fel) {
    if (fel instanceof KvittonaHannAndras) {
      return {
        fel: "Ett av kvittona hann kopplas till ett annat projekt medan du valde. Ladda om sidan och välj kvittona igen.",
      };
    }
    return {
      fel: serverfelMeddelande(fel, { sida: "projekt/kvitton", anrop: "laggTillKvitton", anvandareId }),
    };
  }

  revalidatePath("/");
  revalidatePath("/projekt");
  revalidatePath(`/projekt/${id}`);
  revalidatePath("/kostnad");
  revalidatePath("/kostnad/[id]", "page");
  revalidatePath("/export");
  redirect(`/projekt/${id}`);
}
