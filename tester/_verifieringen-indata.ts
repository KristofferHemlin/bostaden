// Bygger beräkningens indata ur docs/verifieringen.md (tester/_verifieringen.ts):
// en bostad, ett projekt per åtgärd och ett kvitto per betaldatum. Bara
// översättning – inget tal räknas här.

import type { K6aIndata } from "@/doman/export-k6a";
import type { Kostnad, Projekt } from "@/doman/typer";
import { REGELPARAMETRAR } from "./_hjalp";
import type { Facit } from "./_verifieringen";

export const projektId = (nr: number) => `p${nr}`;
export const kostnadId = (nr: number, i: number) => `k${nr}-${i + 1}`;

export function verifieringensProjekt(f: Facit): Projekt[] {
  return f.atgarder.map((a) => ({
    id: projektId(a.nummer),
    namn: a.namn,
    atgardstyp: a.gren === "nybyggnad" ? "nybyggnad" : "utbytt",
    battre_kvalitet: a.gren === "nybyggnad" ? null : a.gren === "utbytt_battre",
    merkostnad: a.merkostnad,
    merkostnad_bas: null,
    skick_forvarv: a.skick?.forvarv ?? null,
    skick_forsaljning: a.skick?.forsaljning ?? null,
    tidigare_gang_samma_del: false,
  }));
}

export function verifieringensKostnader(f: Facit): Kostnad[] {
  return f.atgarder.flatMap((a) =>
    a.kvitton.map((k, i): Kostnad => ({
      id: kostnadId(a.nummer, i),
      totalbelopp: k.belopp,
      betaldatum: k.betaldatum,
      dokumentdatum: k.betaldatum,
      rot_utnyttjat: k.rot,
      forsakringsersattning: 0,
      arkiverad: false,
      rader: [
        ...(k.privat > 0
          ? [{ artikel: "Privat", belopp: k.privat, fordelningar: [{ projekt_id: null, privat: true, andel: 1 }] }]
          : []),
        { artikel: a.namn, belopp: k.belopp - k.privat, fordelningar: [{ projekt_id: projektId(a.nummer), privat: false, andel: 1 }] },
      ],
    })),
  );
}

export function verifieringensIndata(f: Facit, agarandel: number = f.bostad.agarandel): K6aIndata {
  return {
    bostad: {
      upplatelseform: f.bostad.upplatelseform,
      tilltradesdatum: f.bostad.tilltradesdatum,
      forsaljningsdatum: f.bostad.forsaljningsdatum,
      nybyggd_vid_forvarv: f.bostad.forstaAgaren,
      ombildning_fran_hyresratt: false,
    },
    medlemskap: { agarandel },
    projekt: verifieringensProjekt(f),
    kostnader: verifieringensKostnader(f),
    utkast_som_inte_ar_tomma: [],
    regelparametrar: REGELPARAMETRAR,
  };
}

const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Samma bostad i den falska databasen (tester/_falsk-databas.ts), så att
 * exportvyn kan renderas genom hela sin väg: databas, översättning,
 * beräkning, skärm.
 */
export function seedaVerifieringen(
  db: { nollstall: () => void; lagg: (tabell: string, rad: Record<string, unknown>) => Record<string, unknown> },
  f: Facit,
  { anvandareId, bostadId, agarandel }: { anvandareId: string; bostadId: string; agarandel: number },
) {
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: anvandareId, epost: "verifiering@exempel.se" });
  db.lagg("bostad", {
    id: bostadId, adress: "Verifieringsgatan 1", upplatelseform: f.bostad.upplatelseform,
    tilltradesdatum: datum(f.bostad.tilltradesdatum), forsaljningsdatum: datum(f.bostad.forsaljningsdatum),
    nybyggd_vid_forvarv: f.bostad.forstaAgaren, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: anvandareId, bostad_id: bostadId, agarandel, bekraftad_andel: agarandel });
  let n = 0;
  for (const p of verifieringensProjekt(f)) {
    const a = f.atgarder.find((x) => projektId(x.nummer) === p.id)!;
    db.lagg("projekt", {
      ...p, bostad_id: bostadId, ar: Number(a.kvitton[0].betaldatum.slice(0, 4)), klassificerad_av: anvandareId,
    });
  }
  for (const k of verifieringensKostnader(f)) {
    const kost = db.lagg("kostnad", {
      id: k.id, bostad_id: bostadId, leverantor: k.rader[k.rader.length - 1].artikel, anteckning: k.rader[k.rader.length - 1].artikel,
      totalbelopp: k.totalbelopp, rot_utnyttjat: k.rot_utnyttjat || null,
      dokumentdatum: datum(k.dokumentdatum!), betaldatum: datum(k.betaldatum!),
      // Olika tidsstämplar, så att ingen ordning avgörs av slumpen.
      skapad_at: new Date(Date.UTC(2026, 0, 1, 0, n++)),
    });
    for (const r of k.rader) {
      const rad = db.lagg("kostnadsrad", { kostnad_id: kost.id, artikel: r.artikel, belopp: r.belopp });
      for (const fd of r.fordelningar) db.lagg("radfordelning", { kostnadsrad_id: rad.id, ...fd });
    }
  }
}
