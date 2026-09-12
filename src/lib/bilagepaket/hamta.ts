// Serverdelen av bilagepaketet (docs/produktspec.md avsnitt 8,
// "Bilagepaketet som PDF"). Slar ihop K6A-sammanstallningen (src/doman/
// export-k6a.ts) med bilageforteckningen (src/doman/bilagepaket.ts) och
// levererar allt PDF-byggaren i webblasaren behover: sammanstallningens tal,
// forsattssidans uppgifter, och en fardig lista bilagesidor med korta
// signerade URL:er. Sjalva PDF-ritningen sker i webblasaren (samma skal som
// arkivexporten – en serverfunktion som drar alla bilagor genom sig slar i
// storleks- och tidsgranser), sa den har modulen ror aldrig filinnehallet.
//
// VIKTIGT: fallback-kedjan i signeradBilagelank (miniatyr/original nar
// visningsversionen saknas) arvs INTE hit. En bild utan visningsversion far
// url = null har – anroparen (PDF-byggaren) visar da en platshallarsida i
// stallet, aldrig miniatyren eller originalet i tysthet (produktspec 8).

import "server-only";
import { byggBilageforteckning, type BilagepaketKostnad } from "@/doman/bilagepaket";
import { byggK6aExport, type K6aExport, type K6aIndata } from "@/doman/export-k6a";
import { bostadHeader } from "@/lib/bostad-header";
import {
  tillDomanKostnad,
  tillDomanProjekt,
  tillDomanRegelparameter,
} from "@/lib/doman-fran-db";
import { isoDatum } from "@/lib/format";
import { bilagelager } from "@/lib/lagring/klient";
import { prisma } from "@/lib/prisma";
import { radnyckel } from "./radnyckel";
import { bilagepaketFilnamn, bilagepaketSidhuvud } from "./text";

// Manga bilagor kan behova hamtas i tur och ordning medan PDF:en byggs – lanken
// maste racka langre an en enskild bilagevisnings 60 sekunder (src/lib/lagring/
// bilagor.ts), av samma skal som arkivexportens (src/lib/arkivexport/hamta.ts).
const LANK_SEKUNDER = 900;

export interface BilagepaketForsattsdata {
  bostadsnamn: string;
  adress: string | null;
  ort: string | null;
  /** Foreningens namn (bostadsratt) eller fastighetsbeteckning (fastighet).
   *  null -> raden utelamnas helt pa forsattssidan (produktspec 8, mjukt krav). */
  identifiering: string | null;
  upplatelseform: "bostadsratt" | "fastighet";
  tilltradesdatum: string;
  forsaljningsdatum: string;
  agarandelProcent: number;
  /** Datum paketet byggdes, "YYYY-MM-DD". */
  skapadDatum: string;
}

export interface BilagepaketBilagesida {
  nummer: number;
  sidhuvud: string;
  arPdf: boolean;
  /** null -> visningsversionen saknas (eller kunde inte signeras): bilagan far
   *  en platshallarsida i stallet for att tystas bort. */
  url: string | null;
  /** Bilagans eget filnamn, visas pa platshallarsidan nar url ar null. */
  filnamn: string;
}

/** Forklaringen till glappet mellan en sammanstallningsrads belopp och
 *  bilagans kvittobelopp (produktspec 8, "Skillnaden mellan raden och
 *  bilagan maste forklaras i dokumentet"). Summerat over radens bidragande
 *  kostnader – se radnyckel(). */
export interface BilagepaketRadavdrag {
  rotUtnyttjat: number;
  forsakringsersattning: number;
}

export interface BilagepaketData {
  forsattsdata: BilagepaketForsattsdata;
  ex: K6aExport;
  /** Nyckel: radnyckel(rad) – se ./radnyckel.ts. En rad utan nagot avdraget
   *  saknas har helt (ingen dampad rad att rita). */
  radavdrag: Record<string, BilagepaketRadavdrag>;
  bilagesidor: BilagepaketBilagesida[];
  filnamn: string;
}

export type BilagepaketResultat =
  | { ok: true; data: BilagepaketData }
  | { ok: false; fel: string };

export async function hamtaBilagepaketdata(
  bostadId: string,
  agarandel: number,
): Promise<BilagepaketResultat> {
  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });

  // Sidan/knappen ar redan otillganglig fore forsaljning (docs/design.md,
  // Exportvyn) – detta ar bara ett andra skydd mot en direkt begaran.
  if (!bostad.forsaljningsdatum) {
    return { ok: false, fel: "Bostaden är inte markerad som såld." };
  }

  const [projektRader, kostnadRader, regelparameterRader] = await Promise.all([
    prisma.projekt.findMany({
      where: { bostad_id: bostadId },
      orderBy: [{ ar: "desc" }, { skapad_at: "asc" }],
    }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
      orderBy: { skapad_at: "asc" },
    }),
    prisma.regelparameter.findMany(),
  ]);

  const indata: K6aIndata = {
    bostad: {
      upplatelseform: bostad.upplatelseform,
      tilltradesdatum: isoDatum(bostad.tilltradesdatum),
      forsaljningsdatum: isoDatum(bostad.forsaljningsdatum),
    },
    medlemskap: { agarandel },
    projekt: projektRader.map(tillDomanProjekt),
    kostnader: kostnadRader.map(tillDomanKostnad),
    regelparametrar: regelparameterRader.map(tillDomanRegelparameter),
  };

  let ex: K6aExport;
  try {
    ex = byggK6aExport(indata);
  } catch (fel) {
    return {
      ok: false,
      fel: `Underlaget kunde inte beräknas: ${(fel as Error).message}`,
    };
  }

  const alleRader = [...ex.sida1.rader, ...ex.sida2.rader];
  const kostnadIder = new Set<string>();
  for (const rad of alleRader) {
    if (rad.belopp_brutto <= 0) continue;
    for (const id of rad.kostnad_ider) kostnadIder.add(id);
  }

  const kostnadInfoRader =
    kostnadIder.size === 0
      ? []
      : await prisma.kostnad.findMany({
          where: { id: { in: [...kostnadIder] } },
          select: {
            id: true,
            leverantor: true,
            totalbelopp: true,
            betaldatum: true,
            rot_utnyttjat: true,
            forsakringsersattning: true,
            bilagor: {
              where: { uppladdning_bekraftad: true },
              orderBy: { skapad_at: "asc" },
              select: {
                id: true,
                filnamn: true,
                mimetyp: true,
                lagringsnyckel: true,
                visningsnyckel: true,
              },
            },
          },
        });

  // Radurvalet och ordningen ar ren doman-logik (src/doman/bilagepaket.ts) –
  // bygg den forteckningen forst, harled sedan bara signerade lankar for de
  // bilagor som faktiskt kommer med.
  const bilageforteckningKostnader = new Map<string, BilagepaketKostnad>();
  const kostnadsinfo = new Map<
    string,
    {
      leverantor: string | null;
      totalbelopp: number | null;
      rotUtnyttjat: number;
      forsakringsersattning: number;
    }
  >();
  type Bildlank = { bilagaId: string; nyckel: string };
  const bilagaTyp = new Map<string, { arPdf: boolean; filnamn: string }>();
  const lankUppslag: Bildlank[] = [];

  for (const k of kostnadInfoRader) {
    bilageforteckningKostnader.set(k.id, {
      betaldatum: k.betaldatum ? isoDatum(k.betaldatum) : null,
      bilagaIder: k.bilagor.map((b) => b.id),
    });
    kostnadsinfo.set(k.id, {
      leverantor: k.leverantor,
      totalbelopp: k.totalbelopp,
      rotUtnyttjat: k.rot_utnyttjat ?? 0,
      forsakringsersattning: k.forsakringsersattning ?? 0,
    });
    for (const b of k.bilagor) {
      const arPdf = b.mimetyp === "application/pdf";
      bilagaTyp.set(b.id, { arPdf, filnamn: b.filnamn });
      // PDF-bilagor har ingen visningsversion (src/lib/lagring/visning.ts) –
      // originalet ar da den enda versionen och den ratta att foga in som
      // sidor. Bilder anvander UTESLUTANDE visningsversionen, aldrig
      // originalet och aldrig miniatyren (produktspec 8) – saknas den blir
      // nyckeln null och bilagan far en platshallarsida.
      const nyckel = arPdf ? b.lagringsnyckel : b.visningsnyckel;
      if (nyckel) lankUppslag.push({ bilagaId: b.id, nyckel });
    }
  }

  const poster = byggBilageforteckning(alleRader, bilageforteckningKostnader);

  // Skillnaden mellan raden och bilagan maste forklaras i dokumentet
  // (produktspec 8): summera ROT och forsakringsersattning over de kostnader
  // som bidrog till respektive rad, sa att PDF-byggaren kan rita "varav ROT
  // X kr, avgår" under beloppet. En rad utan nagot avdraget far ingen post
  // har alls.
  const radavdrag: Record<string, BilagepaketRadavdrag> = {};
  for (const rad of alleRader) {
    let rotUtnyttjat = 0;
    let forsakringsersattning = 0;
    for (const kostnadId of rad.kostnad_ider) {
      const info = kostnadsinfo.get(kostnadId);
      if (!info) continue;
      rotUtnyttjat += info.rotUtnyttjat;
      forsakringsersattning += info.forsakringsersattning;
    }
    if (rotUtnyttjat > 0 || forsakringsersattning > 0) {
      radavdrag[radnyckel(rad)] = { rotUtnyttjat, forsakringsersattning };
    }
  }

  const lankar = new Map<string, string>();
  if (lankUppslag.length > 0) {
    const { data, error } = await bilagelager().createSignedUrls(
      lankUppslag.map((l) => l.nyckel),
      LANK_SEKUNDER,
    );
    if (!error && data) {
      for (let i = 0; i < lankUppslag.length; i++) {
        const url = data[i]?.signedUrl;
        if (url) lankar.set(lankUppslag[i].bilagaId, url);
      }
    }
    // Misslyckas signeringen far bilagan url = null och visas som en
    // platshallarsida – aldrig ett tyst hal (produktspec 8).
  }

  const bilagesidor: BilagepaketBilagesida[] = poster.map((post) => {
    const typ = bilagaTyp.get(post.bilagaId);
    const info = kostnadsinfo.get(post.kostnadId);
    return {
      nummer: post.nummer,
      sidhuvud: bilagepaketSidhuvud({
        nummer: post.nummer,
        atgard: post.atgard,
        ar: post.ar,
        leverantor: info?.leverantor ?? null,
        totalbelopp: info?.totalbelopp ?? null,
      }),
      arPdf: typ?.arPdf ?? false,
      url: lankar.get(post.bilagaId) ?? null,
      filnamn: typ?.filnamn ?? "okänd fil",
    };
  });

  const { bostadsnamn } = bostadHeader(bostad);
  const forsaljningsdatum = isoDatum(bostad.forsaljningsdatum);
  const forsaljningsAr = Number.parseInt(forsaljningsdatum.slice(0, 4), 10);

  return {
    ok: true,
    data: {
      forsattsdata: {
        bostadsnamn,
        adress: bostad.adress,
        ort: bostad.ort,
        identifiering: bostad.identifiering,
        upplatelseform: bostad.upplatelseform,
        tilltradesdatum: isoDatum(bostad.tilltradesdatum),
        forsaljningsdatum,
        agarandelProcent: agarandel,
        skapadDatum: isoDatum(new Date()),
      },
      ex,
      radavdrag,
      bilagesidor,
      filnamn: bilagepaketFilnamn(bostadsnamn, forsaljningsAr),
    },
  };
}
