// Bilagornas serverlogik: signerade upload-URL:er, bekraftelse, signerade
// visningslankar och radering. ENDAST server. Se produktspec avsnitt 12,
// "Bilagor och lagring".
//
// - Filen gar DIREKT fran webblasaren till Storage via en signerad upload-URL.
//   Den passerar aldrig en serverless-funktion (Vercels 4,5 MB-grans pa
//   request-body). Servern (a) delar ut URL:en efter behorighetskontroll och
//   harleder alltid sjalv sokvagen, (b) bekraftar mot Storage att objektet kom
//   fram innan databasraden skapas.
// - Sokvagen harleds ALLTID pa servern ur kostnadens id och den kontrollerade
//   bostaden. Anvandarens ursprungliga filnamn lagras i databasen, aldrig i
//   sokvagen. Nar klienten rapporterar in vilken nyckel den laddade upp mot
//   kontrolleras den mot exakt det monstret (nyckelHorTillKostnad).
// - Databasraden skapas forst nar Storage bekraftat originalet. HEIC-miniatyren
//   och visningsversionen (produktspec avsnitt 9, "Visningsversion") genereras
//   da server-sida genom att originalet hamtas fran Storage (server -> Storage,
//   ingen 4,5 MB-grans). Misslyckas nagon av delarna skapas raden anda utan den
//   versionen – originalet ar bevisningen och far aldrig bero av att en
//   konvertering lyckas.
// - Visning sker via korta signerade URL:er, skapade efter behorighetskontroll
//   mot medlemskapet. "visning" ger visningsversionen nar en sadan finns,
//   annars miniatyren, annars originalet.
// - Radering sker ENDAST pa uttrycklig begaran och tar bade fil(er) och rad.
//   Ingen automatisk radering nar en kostnad arkiveras eller avklassificeras.

import "server-only";
import { prisma } from "@/lib/prisma";
import {
  MAX_BILAGA_BYTES,
  arVisningsbarBild,
  lagringsnyckel,
  miniatyrnyckel,
  nyckelHorTillKostnad,
  slumpatFilnamn,
  valideraBilaga,
  visningsnyckel,
} from "./bilaga-regler";
import { bilagelager } from "./klient";
import { heicTillJpeg, skalaTillMiniatyr } from "./miniatyr";
import { skalaTillVisningsversion } from "./visning";

const SIGNERAD_LANK_SEKUNDER = 60;

export interface Uppladdningsresultat {
  ok: boolean;
  fel?: string;
  bilagaId?: string;
}

export type SigneradUppladdning =
  | {
      ok: true;
      /** Sokvagen servern harlett – klienten laddar upp mot exakt denna. */
      nyckel: string;
      /** Engangstoken till den signerade upload-URL:en. */
      token: string;
      /** Normaliserad MIME-typ att satta som Content-Type vid uppladdningen. */
      mimetyp: string;
    }
  | { ok: false; fel: string };

/**
 * Steg 1 av uppladdningen: kontrollera behorighet och format, harled sokvagen
 * och dela ut en signerad upload-URL. Filen laddas sedan upp DIREKT fran
 * webblasaren mot den URL:en – aldrig via servern.
 */
export async function skapaSigneradUppladdning(params: {
  bostadId: string;
  kostnadId: string;
  filnamn: string;
  mimetyp: string;
  storlek: number;
}): Promise<SigneradUppladdning> {
  const { bostadId, kostnadId, filnamn, mimetyp, storlek } = params;

  const kostnad = await prisma.kostnad.findFirst({
    where: { id: kostnadId, bostad_id: bostadId },
    select: { id: true },
  });
  if (!kostnad) return { ok: false, fel: "Kostnaden hittades inte." };

  // Grinden ar densamma som forr, men gors nu bade har och i webblasaren – och
  // bucketen har dessutom en egen fileSizeLimit pa 10 MB som sista sparr.
  const validering = valideraBilaga({ mimetyp, storlek, filnamn });
  if (!validering.ok) return { ok: false, fel: validering.fel };
  const { format } = validering;

  const nyckel = lagringsnyckel(
    bostadId,
    kostnadId,
    slumpatFilnamn(format.andelse),
  );

  const { data, error } = await bilagelager().createSignedUploadUrl(nyckel);
  if (error || !data) {
    const text = error?.message ?? "okänt fel";
    return { ok: false, fel: `Uppladdningen kunde inte förberedas: ${text}` };
  }

  return { ok: true, nyckel, token: data.token, mimetyp: format.mimetyp };
}

/** Storlek pa ett Storage-objekt, eller null om det inte gar att bekrafta. */
async function lagringsinfo(nyckel: string): Promise<{ storlek: number } | null> {
  const snitt = nyckel.lastIndexOf("/");
  const mapp = nyckel.slice(0, snitt);
  const namn = nyckel.slice(snitt + 1);

  const { data, error } = await bilagelager().list(mapp, {
    limit: 100,
    search: namn,
  });
  if (error || !data) return null;

  const traff = data.find((o) => o.name === namn);
  if (!traff) return null;

  const storlek = traff.metadata?.size;
  return typeof storlek === "number" ? { storlek } : { storlek: 0 };
}

/**
 * Steg 2 av uppladdningen: bekrafta mot Storage att filen kom fram, generera en
 * ev. HEIC-miniatyr och en visningsversion, och skapa databasraden. Kors forst
 * NAR webblasaren rapporterat att direktuppladdningen lyckats. Ingen rad utan
 * bekraftat objekt.
 */
export async function bekraftaKostnadsbilaga(params: {
  bostadId: string;
  kostnadId: string;
  nyckel: string;
  filnamn: string;
  mimetyp: string;
  storlek: number;
}): Promise<Uppladdningsresultat> {
  const { bostadId, kostnadId, nyckel, filnamn, mimetyp, storlek } = params;

  const kostnad = await prisma.kostnad.findFirst({
    where: { id: kostnadId, bostad_id: bostadId },
    select: { id: true },
  });
  if (!kostnad) return { ok: false, fel: "Kostnaden hittades inte." };

  // Klienten rapporterar in nyckeln; den MASTE se ut precis som en nyckel
  // servern sjalv delat ut for den har bostaden och kostnaden.
  if (!nyckelHorTillKostnad(nyckel, bostadId, kostnadId)) {
    return { ok: false, fel: "Ogiltig sökväg för bilagan." };
  }

  const validering = valideraBilaga({ mimetyp, storlek, filnamn });
  if (!validering.ok) return { ok: false, fel: validering.fel };
  const { format } = validering;

  const lager = bilagelager();

  // Bekrafta mot Storage: objektet MASTE finnas, och det MASTE ligga inom
  // 10 MB-gransen aven om klienten pastod nagot annat.
  const info = await lagringsinfo(nyckel);
  if (!info) {
    return {
      ok: false,
      fel: "Uppladdningen kunde inte bekräftas mot lagringen. Försök igen.",
    };
  }
  const faktiskStorlek = info.storlek > 0 ? info.storlek : storlek;
  if (faktiskStorlek > MAX_BILAGA_BYTES) {
    await lager.remove([nyckel]).catch(() => {});
    return {
      ok: false,
      fel: "Filen är större än 10 MB. Minska den och försök igen.",
    };
  }

  const upplagt: string[] = [nyckel];
  let miniatyr: string | null = null;
  let visning: string | null = null;

  // HEIC kan ingen webblasare visa – en JPG-miniatyr genereras server-sida, och
  // alla bildformat far dessutom en visningsversion (~2000px) for helskarm och
  // PDF-paketet, se produktspec avsnitt 9 "Visningsversion". Bada genereras
  // genom att originalet hamtas fran Storage (server -> Storage har ingen
  // 4,5 MB-grans). Misslyckas nagon av delarna skapas raden anda utan den
  // versionen – originalet ar sparat, och det ar det som ar bevisningen.
  if (format.andelse !== "pdf") {
    try {
      const { data: blob, error } = await lager.download(nyckel);
      if (error || !blob) throw error ?? new Error("kunde inte hämta originalet");
      const original = Buffer.from(await blob.arrayBuffer());

      // HEIC avkodas EN GANG – bade miniatyren och visningsversionen skalas
      // fram ur samma fullstora buffert i stallet for att avkoda originalet
      // pa nytt (produktspec avsnitt 9).
      let visningsunderlag: Buffer = original;
      if (format.kraverMiniatyr) {
        visningsunderlag = await heicTillJpeg(original);

        try {
          const jpeg = await skalaTillMiniatyr(visningsunderlag);
          const mNyckel = miniatyrnyckel(nyckel);
          const mini = await lager.upload(mNyckel, jpeg, {
            contentType: "image/jpeg",
            upsert: true,
          });
          if (mini.error) throw mini.error;
          upplagt.push(mNyckel);
          miniatyr = mNyckel;
        } catch (fel) {
          console.error(
            `Miniatyr kunde inte genereras för bilaga ${nyckel} (kostnad ${kostnadId}):`,
            fel,
          );
        }
      }

      try {
        const jpeg = await skalaTillVisningsversion(visningsunderlag);
        const vNyckel = visningsnyckel(nyckel);
        const vis = await lager.upload(vNyckel, jpeg, {
          contentType: "image/jpeg",
          upsert: true,
        });
        if (vis.error) throw vis.error;
        upplagt.push(vNyckel);
        visning = vNyckel;
      } catch (fel) {
        console.error(
          `Visningsversion kunde inte genereras för bilaga ${nyckel} (kostnad ${kostnadId}):`,
          fel,
        );
      }
    } catch (fel) {
      // Originalet gick inte att hämta från Storage, eller HEIC gick inte att
      // avkoda alls – varken miniatyr eller visningsversion gick att skapa.
      console.error(
        `Bildbehandling misslyckades för bilaga ${nyckel} (kostnad ${kostnadId}):`,
        fel,
      );
    }
  }

  try {
    const rad = await prisma.bilaga.create({
      data: {
        kostnad_id: kostnadId,
        lagringsnyckel: nyckel,
        miniatyrnyckel: miniatyr,
        visningsnyckel: visning,
        filnamn: filnamn || "kvitto",
        mimetyp: format.mimetyp,
        storlek: faktiskStorlek,
        uppladdning_bekraftad: true,
      },
    });
    return { ok: true, bilagaId: rad.id };
  } catch (fel) {
    // Databasraden gick inte att skapa – rensa filerna sa att inga foraldralosa
    // objekt blir kvar.
    await lager.remove(upplagt).catch(() => {});
    const text =
      fel instanceof Error ? fel.message : "okänt fel vid uppladdningen";
    return { ok: false, fel: `Uppladdningen misslyckades: ${text}` };
  }
}

type BilagaMedBostad = {
  id: string;
  lagringsnyckel: string;
  miniatyrnyckel: string | null;
  visningsnyckel: string | null;
  filnamn: string;
  mimetyp: string;
  kostnad: { bostad_id: string } | null;
};

/** Laddar bilagan och slapper bara igenom den om anvandaren ar medlem i dess bostad. */
async function kravAtkomst(
  bilagaId: string,
  anvandareId: string,
): Promise<BilagaMedBostad | null> {
  const bilaga = await prisma.bilaga.findUnique({
    where: { id: bilagaId },
    select: {
      id: true,
      lagringsnyckel: true,
      miniatyrnyckel: true,
      visningsnyckel: true,
      filnamn: true,
      mimetyp: true,
      kostnad: { select: { bostad_id: true } },
    },
  });
  if (!bilaga || !bilaga.kostnad) return null;

  const medlem = await prisma.medlemskap.findFirst({
    where: { anvandare_id: anvandareId, bostad_id: bilaga.kostnad.bostad_id },
    select: { id: true },
  });
  if (!medlem) return null;

  return bilaga;
}

export type Lankvariant = "original" | "visning";

/**
 * Kort signerad URL, skapad pa servern efter behorighetskontroll. "visning" ger
 * visningsversionen nar en sadan finns, annars miniatyren (HEIC utan
 * visningsversion), annars originalet; "original" ger alltid originalfilen.
 */
export async function signeradBilagelank(
  bilagaId: string,
  anvandareId: string,
  variant: Lankvariant = "visning",
): Promise<string | null> {
  const bilaga = await kravAtkomst(bilagaId, anvandareId);
  if (!bilaga) return null;

  const nyckel =
    variant === "visning"
      ? bilaga.visningsnyckel ?? bilaga.miniatyrnyckel ?? bilaga.lagringsnyckel
      : bilaga.lagringsnyckel;

  const { data, error } = await bilagelager().createSignedUrl(
    nyckel,
    SIGNERAD_LANK_SEKUNDER,
  );
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Tar bort bade fil(er) och databaspost. Sker ENDAST pa uttrycklig begaran fran
 * anvandaren – aldrig automatiskt.
 */
export async function taBortBilaga(
  bilagaId: string,
  anvandareId: string,
): Promise<{ ok: boolean; fel?: string }> {
  const bilaga = await kravAtkomst(bilagaId, anvandareId);
  if (!bilaga) return { ok: false, fel: "Bilagan hittades inte." };

  const nycklar = [bilaga.lagringsnyckel];
  if (bilaga.miniatyrnyckel) nycklar.push(bilaga.miniatyrnyckel);
  if (bilaga.visningsnyckel) nycklar.push(bilaga.visningsnyckel);

  const { error } = await bilagelager().remove(nycklar);
  if (error) {
    return { ok: false, fel: `Kunde inte ta bort filen: ${error.message}` };
  }

  await prisma.bilaga.delete({ where: { id: bilaga.id } });
  return { ok: true };
}

/**
 * Tar bort SAMTLIGA bilagor (fil + ev. miniatyr/visningsversion + databasrad)
 * for en kostnad. Anvands nar kostnaden raderas helt – det ar en uttrycklig
 * begaran fran anvandaren (produktspec 12: bilagor raderas aldrig automatiskt,
 * bara pa uttrycklig begaran, och da tas bade fil och rad bort). Sokvagen
 * kommer aldrig fran klienten: bilagorna slas upp ur kostnadens id efter
 * behorighetskontroll mot medlemskapet. Kostnadsraden i sig tas bort av
 * anroparen (cascaden stadar kvarvarande bilaga-rader), men vi rensar Storage
 * forst sa att inga foraldralosa filer blir kvar.
 */
export async function taBortAllaBilagorForKostnad(
  kostnadId: string,
  anvandareId: string,
): Promise<{ ok: boolean; fel?: string }> {
  const kostnad = await prisma.kostnad.findUnique({
    where: { id: kostnadId },
    select: {
      bostad_id: true,
      bilagor: {
        select: {
          id: true,
          lagringsnyckel: true,
          miniatyrnyckel: true,
          visningsnyckel: true,
        },
      },
    },
  });
  if (!kostnad) return { ok: false, fel: "Kostnaden hittades inte." };

  const medlem = await prisma.medlemskap.findFirst({
    where: { anvandare_id: anvandareId, bostad_id: kostnad.bostad_id },
    select: { id: true },
  });
  if (!medlem) return { ok: false, fel: "Kostnaden hittades inte." };

  if (kostnad.bilagor.length === 0) return { ok: true };

  const nycklar = kostnad.bilagor.flatMap((b) =>
    [b.lagringsnyckel, b.miniatyrnyckel, b.visningsnyckel].filter(
      (n): n is string => n !== null,
    ),
  );
  const { error } = await bilagelager().remove(nycklar);
  if (error) {
    return { ok: false, fel: `Kunde inte ta bort bilagorna: ${error.message}` };
  }

  await prisma.bilaga.deleteMany({
    where: { id: { in: kostnad.bilagor.map((b) => b.id) } },
  });
  return { ok: true };
}

export interface Bilagevy {
  id: string;
  filnamn: string;
  arPdf: boolean;
  /** Kan visas som en bild i granssnittet. Falskt for PDF och for HEIC vars
   *  miniatyr inte gick att generera – da visas dokumentikonen i stallet. */
  arBild: boolean;
  /** Sant nar dokumentavlasningen redan korts pa bilagan (oavsett utfall). Ett
   *  aterupptat utkast kor da inte avlasningen om. */
  analyserad: boolean;
}

/** Bilagorna for en kostnad, i uppladdningsordning. */
export async function listaKostnadsbilagor(
  kostnadId: string,
): Promise<Bilagevy[]> {
  const rader = await prisma.bilaga.findMany({
    where: { kostnad_id: kostnadId },
    orderBy: { skapad_at: "asc" },
    select: {
      id: true,
      filnamn: true,
      mimetyp: true,
      miniatyrnyckel: true,
      dokument_analyserad: true,
    },
  });
  return rader.map((b) => ({
    id: b.id,
    filnamn: b.filnamn,
    arPdf: b.mimetyp === "application/pdf",
    arBild: arVisningsbarBild(b.mimetyp, b.miniatyrnyckel !== null),
    analyserad: b.dokument_analyserad,
  }));
}
