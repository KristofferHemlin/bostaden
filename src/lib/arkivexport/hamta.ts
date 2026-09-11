// Serverdelen av arkivexporten (docs/produktspec.md avsnitt 12, "Arkivexport
// tidigt"). Bygger listan av {sokvag, url} som webblasaren sedan hamtar och
// packar sjalv – servern rör aldrig filinnehallet. Se
// src/lib/arkivexport/namngivning.ts for sjalva namngivningsreglerna.

import "server-only";
import { filandelse, kannIgenFormat } from "@/lib/lagring/bilaga-regler";
import { bilagelager } from "@/lib/lagring/klient";
import { prisma } from "@/lib/prisma";
import { byggArkivsokvagar, type ArkivfilIndata } from "./namngivning";

// Arkivet kan innehalla manga filer och webblasaren hamtar dem en och en –
// lanken maste racka hela vagen, inte bara de 60 sekunder en enskild
// bilagevisning far (src/lib/lagring/bilagor.ts).
const ARKIV_LANK_SEKUNDER = 600;

export interface Arkivfil {
  /** Fullstandig sokvag i zip-arkivet, t.ex. "2026/2026-04-14 BAUHAUS 1 997,05 kr.jpg". */
  sokvag: string;
  /** Kort signerad URL till originalfilen i Storage. */
  url: string;
}

export type Arkivlista =
  | { ok: true; filer: Arkivfil[] }
  | { ok: false; fel: string };

/**
 * Samtliga bilagor for bostaden, som signerade URL:er med fardiga filnamn.
 * Ingen JSON, ingen CSV – bara bilagorna (produktspec 12).
 */
export async function hamtaArkivlista(bostadId: string): Promise<Arkivlista> {
  const bilagor = await prisma.bilaga.findMany({
    where: {
      uppladdning_bekraftad: true,
      kostnad: { bostad_id: bostadId },
    },
    orderBy: [{ kostnad: { betaldatum: "asc" } }, { skapad_at: "asc" }],
    select: {
      id: true,
      lagringsnyckel: true,
      filnamn: true,
      mimetyp: true,
      kostnad: {
        select: {
          betaldatum: true,
          leverantor: true,
          anteckning: true,
          totalbelopp: true,
        },
      },
    },
  });

  if (bilagor.length === 0) return { ok: true, filer: [] };

  const indata: ArkivfilIndata[] = bilagor.map((b) => ({
    bilagaId: b.id,
    betaldatum: b.kostnad?.betaldatum ?? null,
    leverantor: b.kostnad?.leverantor ?? null,
    anteckning: b.kostnad?.anteckning ?? null,
    // Utkast utan totalbelopp forekommer i teorin (bilagan laddades upp innan
    // beloppet fylldes i) – da star bara datum och namn i filnamnet.
    belopp: b.kostnad?.totalbelopp ?? 0,
    andelse:
      kannIgenFormat(b.mimetyp, b.filnamn)?.andelse ||
      filandelse(b.filnamn) ||
      "bin",
  }));

  const sokvagar = byggArkivsokvagar(indata);
  const nycklar = bilagor.map((b) => b.lagringsnyckel);

  const { data, error } = await bilagelager().createSignedUrls(
    nycklar,
    ARKIV_LANK_SEKUNDER,
  );
  if (error || !data) {
    return {
      ok: false,
      fel: `Kunde inte skapa nedladdningslänkar: ${error?.message ?? "okänt fel"}`,
    };
  }

  const filer: Arkivfil[] = [];
  const saknade: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const signerad = data[i]?.signedUrl;
    if (!signerad) {
      saknade.push(sokvagar[i].sokvag);
      continue;
    }
    filer.push({ sokvag: sokvagar[i].sokvag, url: signerad });
  }

  if (saknade.length > 0) {
    return {
      ok: false,
      fel: `Kunde inte skapa nedladdningslänkar för ${saknade.length} av ${bilagor.length} bilagor. Försök igen.`,
    };
  }

  return { ok: true, filer };
}
