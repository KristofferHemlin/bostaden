import { describe, expect, it } from "vitest";
import { bidragForKostnad } from "@/doman/berakningar";
import { byggBilageforteckning } from "@/doman/bilagepaket";
import {
  beloppIKolumnen,
  byggK6aExport,
  type K6aExportrad,
} from "@/doman/export-k6a";
import {
  bakreGransForklaring,
  reparationsfonsterForklaring,
  troskelForklaring,
} from "@/doman/regeltext";
import type { Kostnad } from "@/doman/typer";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// docs/design.md, Skarmuppbyggnad: "En kolumn visar vad den heter." Belopp
// ar vad atgarden kostade; Avdragsgill del ar vad som gar till deklarationen.
// Faller en atgard bort ar den avdragsgilla delen noll, men beloppet star
// kvar.
//
// Uppmatt 2026-10-18 pa ett konto som korde hela andra halvan av produkten:
// villa, tilltrade 2016-06-01, sald 2026-09-15. Badrumsgolvet 2017 (42 000 kr,
// utanfor femarsfonstret) och ytterbelysningen 2024 (3 200 kr, under
// troskeln) redovisades som "0 kr | 0 kr".

const PROJEKT = [
  projekt({ id: "uterum", namn: "Byggde ett uterum", atgardstyp: "nybyggnad" }),
  projekt({
    id: "golv",
    namn: "Bytte ut det trasiga badrumsgolvet",
    atgardstyp: "utbytt",
    battre_kvalitet: false,
    skick_forvarv: 1,
    skick_forsaljning: 4,
  }),
  projekt({
    id: "maleri",
    namn: "Målade om",
    atgardstyp: "utbytt",
    battre_kvalitet: false,
    skick_forvarv: 2,
    skick_forsaljning: 4,
  }),
  projekt({
    id: "belysning",
    namn: "Bytte ut den trasiga ytterbelysningen",
    atgardstyp: "utbytt",
    battre_kvalitet: false,
    skick_forvarv: 1,
    skick_forsaljning: 3,
  }),
];

const KOSTNADER: Kostnad[] = [
  kostnad({ id: "k-uterum", totalbelopp: 9_500_000, betaldatum: "2017-05-10", projekt_id: "uterum" }),
  kostnad({ id: "k-golv", totalbelopp: 4_200_000, betaldatum: "2017-08-20", projekt_id: "golv" }),
  kostnad({ id: "k-maleri", totalbelopp: 6_000_000, betaldatum: "2023-04-02", projekt_id: "maleri" }),
  kostnad({ id: "k-belysning", totalbelopp: 320_000, betaldatum: "2024-09-01", projekt_id: "belysning" }),
];

const EX = byggK6aExport({
  bostad: {
    upplatelseform: "fastighet",
    tilltradesdatum: "2016-06-01",
    forsaljningsdatum: "2026-09-15",
    nybyggd_vid_forvarv: false,
  },
  medlemskap: { agarandel: 100 },
  projekt: PROJEKT,
  kostnader: KOSTNADER,
  kostnader_med_bilaga: [],
  regelparametrar: REGELPARAMETRAR,
});

/** Vad atgarden faktiskt kostade: summan av kostnadernas bidrag till den,
 *  raknad ur testdatan – inte ett forvantat tal. */
function faktiskSumma(rad: K6aExportrad): number {
  const p = PROJEKT.find((x) => x.namn === rad.atgard)!;
  return rad.kostnad_ider
    .map((id) => KOSTNADER.find((k) => k.id === id)!)
    .reduce((s, k) => s + bidragForKostnad(k, p.id), 0);
}

function rad2(namn: string): K6aExportrad {
  const r = EX.sida2.rader.find((x) => x.atgard === namn);
  if (!r) throw new Error(`Ingen rad pa sida 2 for ${namn}`);
  return r;
}

describe("sida 2: beloppet står kvar när åtgärden faller bort", () => {
  it("varje rad på sida 2 visar vad åtgärden kostade", () => {
    expect(EX.sida2.rader.length).toBeGreaterThan(0);
    for (const r of EX.sida2.rader) {
      expect(beloppIKolumnen(r)).toBe(faktiskSumma(r));
    }
  });

  it("badrumsgolvet 2017: hela beloppet, 0 kr avdragsgill del, femårsregeln som skäl", () => {
    const r = rad2("Bytte ut det trasiga badrumsgolvet");
    expect(beloppIKolumnen(r)).toBe(faktiskSumma(r));
    expect(beloppIKolumnen(r)).toBeGreaterThan(0);
    expect(r.avdragsgill_del_brutto).toBe(0);
    expect(r.forklaring).toBe(reparationsfonsterForklaring(5));
  });

  it("ytterbelysningen 2024: hela beloppet, 0 kr avdragsgill del, tröskeln som skäl", () => {
    const r = rad2("Bytte ut den trasiga ytterbelysningen");
    expect(beloppIKolumnen(r)).toBe(faktiskSumma(r));
    expect(beloppIKolumnen(r)).toBeGreaterThan(0);
    expect(r.avdragsgill_del_brutto).toBe(0);
    expect(r.forklaring).toBe(troskelForklaring(500_000));
  });

  it("en rad som räknas: beloppet är detsamma, och den avdragsgilla delen är skickfaktorn av det", () => {
    const r = rad2("Målade om");
    expect(beloppIKolumnen(r)).toBe(faktiskSumma(r));
    // (4 − 2) / 5 av hela beloppet – avrundat uppat, men har jamnt.
    expect(r.avdragsgill_del_brutto).toBe((faktiskSumma(r) * 2) / 5);
  });

  it("ruta 5 summerar bara den avdragsgilla delen, inte beloppen", () => {
    expect(EX.ruta5_brutto).toBe(
      EX.sida2.rader.reduce((s, r) => s + (r.avdragsgill_del_brutto ?? 0), 0),
    );
  });
});

describe("det som inte ska ändras", () => {
  it("en bortfallen rad får fortfarande inga bilagor i bilagepaketet", () => {
    const kostnadsinfo = new Map(
      KOSTNADER.map((k) => [k.id, { betaldatum: k.betaldatum, bilagaIder: [`b-${k.id}`] }]),
    );
    const poster = byggBilageforteckning(
      [...EX.sida1.rader, ...EX.sida2.rader],
      kostnadsinfo,
    );
    const med = new Set(poster.map((p) => p.kostnadId));
    expect(med.has("k-golv")).toBe(false);
    expect(med.has("k-belysning")).toBe(false);
    expect(med.has("k-maleri")).toBe(true);
  });

  it("ruta 4 summerar den avdragsgilla delen på sida 1, inte beloppen", () => {
    expect(EX.ruta4_brutto).toBe(
      EX.sida1.rader.reduce((s, r) => s + (r.avdragsgill_del_brutto ?? 0), 0),
    );
  });
});

// docs/design.md, Skarmuppbyggnad: "Båda sidorna har samma två kolumner."
// Troskeln traffar en grundforbattring precis som en reparation, och ett ar
// med en enda liten forbattring under 5 000 kr ar inget udda fall.
describe("sida 1: beloppet står kvar när grundförbättringen faller bort", () => {
  it("varje rad på sida 1 visar vad åtgärden kostade", () => {
    for (const r of EX.sida1.rader) {
      expect(beloppIKolumnen(r)).toBe(faktiskSumma(r));
    }
  });

  it("en grundförbättring som faller på tröskeln: hela beloppet, 0 kr avdragsgill del, tröskeln som skäl", () => {
    const brevlada = projekt({ id: "brevlada", namn: "Satte upp en brevlåda", atgardstyp: "nytt_tillagg" });
    const k = kostnad({ id: "k-brevlada", totalbelopp: 320_000, betaldatum: "2025-05-01", projekt_id: "brevlada" });
    const ex = byggK6aExport({
      bostad: { upplatelseform: "fastighet", tilltradesdatum: "2016-06-01", forsaljningsdatum: "2026-09-15", nybyggd_vid_forvarv: false },
      medlemskap: { agarandel: 100 },
      projekt: [brevlada],
      kostnader: [k],
      kostnader_med_bilaga: [],
      regelparametrar: REGELPARAMETRAR,
    });
    const r = ex.sida1.rader[0];
    expect(beloppIKolumnen(r)).toBe(bidragForKostnad(k, "brevlada"));
    expect(beloppIKolumnen(r)).toBeGreaterThan(0);
    expect(r.avdragsgill_del_brutto).toBe(0);
    expect(r.forklaring).toBe(troskelForklaring(500_000));
    expect(ex.ruta4_brutto).toBe(0);
  });

  it("en grundförbättring före den bakre gränsen: hela beloppet, 0 kr avdragsgill del, och ett skäl med årtalet", () => {
    const k = kostnad({ id: "k-1972", totalbelopp: 900_000, betaldatum: "1972-06-01", projekt_id: "p1" });
    const ex = byggK6aExport({
      bostad: { upplatelseform: "bostadsratt", tilltradesdatum: "1970-01-01", forsaljningsdatum: "2026-09-15", nybyggd_vid_forvarv: false },
      medlemskap: { agarandel: 100 },
      projekt: [projekt({ atgardstyp: "nybyggnad" })],
      kostnader: [k],
      kostnader_med_bilaga: [],
      regelparametrar: REGELPARAMETRAR,
    });
    const r = ex.sida1.rader[0];
    expect(beloppIKolumnen(r)).toBe(bidragForKostnad(k, "p1"));
    expect(r.avdragsgill_del_brutto).toBe(0);
    expect(r.forklaring).toBe(bakreGransForklaring(1974, "bostadsratt"));
  });

  it("utan försäljning har den bakre gränsen samma skäl", () => {
    const k = kostnad({ id: "k-1972", totalbelopp: 900_000, betaldatum: "1972-06-01", projekt_id: "p1" });
    const ex = byggK6aExport({
      bostad: { upplatelseform: "bostadsratt", tilltradesdatum: "1970-01-01", forsaljningsdatum: null, nybyggd_vid_forvarv: false },
      medlemskap: { agarandel: 100 },
      projekt: [projekt({ atgardstyp: "nybyggnad" })],
      kostnader: [k],
      kostnader_med_bilaga: [],
      regelparametrar: REGELPARAMETRAR,
    });
    expect(ex.sida1.rader[0].forklaring).toBe(
      bakreGransForklaring(1974, "bostadsratt"),
    );
  });
});
