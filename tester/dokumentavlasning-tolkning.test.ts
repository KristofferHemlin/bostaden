import { describe, expect, it } from "vitest";
import {
  TOMT_DOKUMENTFALT,
  avlasningsrapporter,
  tolkaDokumentsvar,
  tolkaDokumentsvarMedKontroll,
} from "@/lib/dokumentavlasning/tolkning";

// Dokumentavlasningen (produktspec avsnitt 9) skickar kvittot till en sprakmodell
// och far tillbaka falten datum, totalbelopp inklusive moms, valuta, leverantor
// och utnyttjat ROT-avdrag. Modellsvaret ar text och ska tolkas DEFENSIVT: saknade eller
// olasbara falt blir null, aldrig en gissning. Ett gissat belopp – eller ett
// eurobelopp i ett kronfalt – som hamnar i ett deklarationsunderlag ar det
// varsta felet appen kan gora. Darfor testas parsningen fore implementationen
// och tacker varje satt svaret kan vara trasigt pa.

describe("tolkaDokumentsvar: rent modellsvar", () => {
  it("tolkar ett rent JSON-objekt med alla tre falt", () => {
    const svar =
      '{"datum":"2026-08-22","att_betala":1020.95,"leverantor":"Bauhaus Bromma"}';
    expect(tolkaDokumentsvar(svar)).toEqual({
      datum: "2026-08-22",
      totalbelopp: 102095,
      leverantor: "Bauhaus Bromma",
      rot_utnyttjat: null,
    });
  });

  it("tolkar JSON inne i ett ```json-kodstaket", () => {
    const svar =
      '```json\n{\n  "datum": "2026-08-22",\n  "att_betala": 1020.95,\n  "leverantor": "Bauhaus"\n}\n```';
    expect(tolkaDokumentsvar(svar)).toEqual({
      datum: "2026-08-22",
      totalbelopp: 102095,
      leverantor: "Bauhaus",
      rot_utnyttjat: null,
    });
  });

  it("tolkar JSON aven med omkringliggande text fran modellen", () => {
    const svar =
      'Har ar uppgifterna jag kunde lasa ut:\n{"datum":"2026-08-22","att_betala":499,"leverantor":"Clas Ohlson"}\nHor av dig om nagot ser fel ut.';
    expect(tolkaDokumentsvar(svar)).toEqual({
      datum: "2026-08-22",
      totalbelopp: 49900,
      leverantor: "Clas Ohlson",
      rot_utnyttjat: null,
    });
  });

  it("tolkar en faktura med utnyttjat ROT-avdrag", () => {
    const svar =
      '{"datum":"2026-09-01","summa_fore_rot":50000,"att_betala":41000,"valuta":"SEK","leverantor":"K-Bygg Sverige AB","rot_utnyttjat":9000}';
    expect(tolkaDokumentsvar(svar)).toEqual({
      datum: "2026-09-01",
      totalbelopp: 5000000,
      leverantor: "K-Bygg Sverige AB",
      rot_utnyttjat: 900000,
    });
  });
});

describe("tolkaDokumentsvar: trasiga eller tomma svar ger inga gissningar", () => {
  it("trasig JSON ger alla falt null", () => {
    expect(tolkaDokumentsvar('{"datum":"2026-08-22", "att_betala":')).toEqual(
      TOMT_DOKUMENTFALT,
    );
  });

  it("svar helt utan JSON ger alla falt null", () => {
    expect(
      tolkaDokumentsvar("Jag kan tyvarr inte lasa ut nagot ur den har bilden."),
    ).toEqual(TOMT_DOKUMENTFALT);
  });

  it("tom strang ger alla falt null", () => {
    expect(tolkaDokumentsvar("")).toEqual(TOMT_DOKUMENTFALT);
  });

  it("tomt JSON-objekt ger alla falt null", () => {
    expect(tolkaDokumentsvar("{}")).toEqual(TOMT_DOKUMENTFALT);
  });

  it("JSON-array (fel form) ger alla falt null", () => {
    expect(tolkaDokumentsvar('["2026-08-22", 1020.95]')).toEqual(
      TOMT_DOKUMENTFALT,
    );
  });

  it("icke-strang in ger alla falt null", () => {
    expect(tolkaDokumentsvar(null)).toEqual(TOMT_DOKUMENTFALT);
    expect(tolkaDokumentsvar(undefined)).toEqual(TOMT_DOKUMENTFALT);
    expect(tolkaDokumentsvar(42)).toEqual(TOMT_DOKUMENTFALT);
  });
});

describe("tolkaDokumentsvar: falt som saknas eller ar null tolkas inte till nagot", () => {
  it("ett falt satt, de andra utelamnade -> de andra blir null", () => {
    expect(tolkaDokumentsvar('{"leverantor":"Bauhaus Bromma"}')).toEqual({
      datum: null,
      totalbelopp: null,
      leverantor: "Bauhaus Bromma",
      rot_utnyttjat: null,
    });
  });

  it("falt satt till null i JSON forblir null", () => {
    expect(
      tolkaDokumentsvar('{"datum":null,"att_betala":null,"leverantor":null}'),
    ).toEqual(TOMT_DOKUMENTFALT);
  });
});

describe("tolkaDokumentsvar: datum", () => {
  it("giltigt YYYY-MM-DD behalls oforandrat", () => {
    expect(tolkaDokumentsvar('{"datum":"2015-03-07"}').datum).toBe(
      "2015-03-07",
    );
  });

  it("orimligt datum (2026-13-40) ger null", () => {
    expect(tolkaDokumentsvar('{"datum":"2026-13-40"}').datum).toBe(null);
  });

  it("31 februari finns inte -> null", () => {
    expect(tolkaDokumentsvar('{"datum":"2026-02-31"}').datum).toBe(null);
  });

  it("fritext-datum (fel format) ger null, inte en gissning", () => {
    expect(tolkaDokumentsvar('{"datum":"22 augusti 2026"}').datum).toBe(null);
  });

  it("datum med tid ger null (bara ren date godtas)", () => {
    expect(tolkaDokumentsvar('{"datum":"2026-08-22T13:37:00Z"}').datum).toBe(
      null,
    );
  });

  it("ar langt utanfor rimligt intervall ger null", () => {
    expect(tolkaDokumentsvar('{"datum":"0026-08-22"}').datum).toBe(null);
  });

  it("datum som tal ger null", () => {
    expect(tolkaDokumentsvar('{"datum":20260822}').datum).toBe(null);
  });
});

describe("tolkaDokumentsvar: totalbelopp (heltal oren, inklusive moms)", () => {
  it("tal med decimaler tolkas till oren", () => {
    expect(tolkaDokumentsvar('{"att_betala":1020.95}').totalbelopp).toBe(
      102095,
    );
  });

  it("heltal tolkas som kronor", () => {
    expect(tolkaDokumentsvar('{"att_betala":499}').totalbelopp).toBe(49900);
  });

  it("belopp som svensk strang med tusentalsavgransare tolkas till oren", () => {
    expect(tolkaDokumentsvar('{"att_betala":"1 020,95"}').totalbelopp).toBe(
      102095,
    );
  });

  it("belopp med kr-suffix tolkas anda", () => {
    expect(tolkaDokumentsvar('{"att_betala":"1 020,95 kr"}').totalbelopp).toBe(
      102095,
    );
  });

  it("noll ger null (inget kvitto ar pa noll kronor)", () => {
    expect(tolkaDokumentsvar('{"att_betala":0}').totalbelopp).toBe(null);
  });

  it("negativt belopp ger null", () => {
    expect(tolkaDokumentsvar('{"att_betala":-199}').totalbelopp).toBe(null);
  });

  it("olasbar belopssträng ger null", () => {
    expect(tolkaDokumentsvar('{"att_betala":"ca tusen"}').totalbelopp).toBe(
      null,
    );
  });

  it("avrundar oren korrekt vid flyttalsfel", () => {
    expect(tolkaDokumentsvar('{"att_betala":19.99}').totalbelopp).toBe(1999);
  });
});

describe("tolkaDokumentsvar: valuta – bara kronbelopp slapps igenom", () => {
  it("valuta SEK ger beloppet i oren", () => {
    expect(
      tolkaDokumentsvar('{"att_betala":1020.95,"valuta":"SEK"}').totalbelopp,
    ).toBe(102095);
  });

  it("valuta 'kr' godtas ocksa", () => {
    expect(
      tolkaDokumentsvar('{"att_betala":499,"valuta":"kr"}').totalbelopp,
    ).toBe(49900);
  });

  it("valuta EUR nollar beloppet aven om modellen fyllt i ett tal", () => {
    expect(
      tolkaDokumentsvar('{"att_betala":1020.95,"valuta":"EUR"}').totalbelopp,
    ).toBe(null);
  });

  it("valuta USD nollar beloppet", () => {
    expect(
      tolkaDokumentsvar('{"att_betala":50,"valuta":"USD"}').totalbelopp,
    ).toBe(null);
  });

  it("euro-kvitto: datum och leverantor tolkas anda, bara beloppen nollas", () => {
    expect(
      tolkaDokumentsvar(
        '{"datum":"2026-08-22","att_betala":19.90,"valuta":"EUR","leverantor":"Lidl"}',
      ),
    ).toEqual({
      datum: "2026-08-22",
      totalbelopp: null,
      leverantor: "Lidl",
      rot_utnyttjat: null,
    });
  });

  it("modellen foljde instruktionen och nollade beloppet sjalv", () => {
    expect(
      tolkaDokumentsvar('{"att_betala":null,"valuta":"EUR"}').totalbelopp,
    ).toBe(null);
  });

  it("valuta som saknas gor ingen invandning – beloppet slapps igenom", () => {
    expect(tolkaDokumentsvar('{"att_betala":499}').totalbelopp).toBe(49900);
  });

  it("valuta av fel typ behandlas konservativt och nollar beloppet", () => {
    expect(
      tolkaDokumentsvar('{"att_betala":499,"valuta":978}').totalbelopp,
    ).toBe(null);
  });
});

describe("tolkaDokumentsvar: leverantor", () => {
  it("trimmar och behaller namnet", () => {
    expect(
      tolkaDokumentsvar('{"leverantor":"  Bauhaus Bromma  "}').leverantor,
    ).toBe("Bauhaus Bromma");
  });

  it("tom strang ger null", () => {
    expect(tolkaDokumentsvar('{"leverantor":""}').leverantor).toBe(null);
  });

  it("platshallare som 'okant' ger null, inte texten", () => {
    expect(tolkaDokumentsvar('{"leverantor":"Okänt"}').leverantor).toBe(null);
    expect(tolkaDokumentsvar('{"leverantor":"N/A"}').leverantor).toBe(null);
    expect(tolkaDokumentsvar('{"leverantor":"null"}').leverantor).toBe(null);
  });

  it("leverantor som tal ger null", () => {
    expect(tolkaDokumentsvar('{"leverantor":12345}').leverantor).toBe(null);
  });
});

// ROT-avdraget (docs/design.md, "ROT-avdrag"): avlasningen far fylla i
// rot_utnyttjat NAR det gar att lasa ur dokumentet. Samma defensiva regler som
// for totalbeloppet: bara kronbelopp, saknade eller olasbara varden blir null,
// aldrig en gissning. ROT lagras alltid i kronor, aldrig som procentsats – en
// procentsats slinker inte igenom beloppstolkningen, men testas anda. Modellen
// ombeds inte langre om arbetskostnad – bara ROT-beloppet paverkar underlaget.

describe("tolkaDokumentsvar: rot_utnyttjat (kronor, aldrig procent)", () => {
  it("beloppet i kronor tolkas till oren", () => {
    expect(tolkaDokumentsvar('{"rot_utnyttjat":9000}').rot_utnyttjat).toBe(
      900000,
    );
  });

  it("tal med decimaler tolkas till oren", () => {
    expect(tolkaDokumentsvar('{"rot_utnyttjat":8999.50}').rot_utnyttjat).toBe(
      899950,
    );
  });

  it("strang med kr-suffix tolkas anda", () => {
    expect(
      tolkaDokumentsvar('{"rot_utnyttjat":"9 000 kr"}').rot_utnyttjat,
    ).toBe(900000);
  });

  it("falt som saknas ger null", () => {
    expect(tolkaDokumentsvar('{"att_betala":50000}').rot_utnyttjat).toBe(null);
  });

  it("falt satt till null forblir null", () => {
    expect(tolkaDokumentsvar('{"rot_utnyttjat":null}').rot_utnyttjat).toBe(
      null,
    );
  });

  it("noll ger null", () => {
    expect(tolkaDokumentsvar('{"rot_utnyttjat":0}').rot_utnyttjat).toBe(null);
  });

  it("negativt belopp ger null", () => {
    expect(tolkaDokumentsvar('{"rot_utnyttjat":-1500}').rot_utnyttjat).toBe(
      null,
    );
  });

  it("en procentsats ('30%') slinker inte igenom som ett belopp", () => {
    // "30%" -> siffrorna "30" blir 30 kr, men det ar inte det testet bevakar:
    // modellen instrueras att aldrig skicka en procentsats. Kommer den anda in
    // som ren text utan siffror blir det null.
    expect(
      tolkaDokumentsvar('{"rot_utnyttjat":"trettio procent"}').rot_utnyttjat,
    ).toBe(null);
  });

  it("nollas nar valutan inte ar kronor", () => {
    expect(
      tolkaDokumentsvar('{"rot_utnyttjat":900,"valuta":"USD"}').rot_utnyttjat,
    ).toBe(null);
  });

  it("slapps igenom nar valuta saknas", () => {
    expect(tolkaDokumentsvar('{"rot_utnyttjat":9000}').rot_utnyttjat).toBe(
      900000,
    );
  });

  it("datum och leverantor tolkas anda nar valutan blockerar beloppen", () => {
    expect(
      tolkaDokumentsvar(
        '{"datum":"2026-09-01","att_betala":5000,"valuta":"EUR","leverantor":"Baumeister GmbH","rot_utnyttjat":900}',
      ),
    ).toEqual({
      datum: "2026-09-01",
      totalbelopp: null,
      leverantor: "Baumeister GmbH",
      rot_utnyttjat: null,
    });
  });
});

// Totalbeloppet ar summan FORE ROT (docs/design.md, "ROT-avdrag"). Underlaget
// raknas som totalbelopp minus ROT, sa laser avlasningen in "Att betala" – som
// redan ar efter avdraget – dras ROT tva ganger. Uppmatt 2026-09-28: 48 650
// exkl. moms, 12 162,50 moms, 11 587,50 ROT, 49 225 att betala lastes in som
// totalbelopp 49 225, och startskarmen visade 37 637,50 dar ratt tal var 49 225.
//
// Totalbeloppet raknas alltid som att_betala + rot_utnyttjat – aldrig ur
// summa_fore_rot (CLAUDE.md, "Avlasningen laser, den raknar aldrig").

describe("tolkaDokumentsvar: totalbeloppet pa en ROT-faktura ar att betala plus ROT", () => {
  it("summa_fore_rot som stammer med att betala plus ROT andrar ingenting", () => {
    const f = tolkaDokumentsvar(
      '{"summa_fore_rot":60812.50,"att_betala":49225,"rot_utnyttjat":11587.50,"valuta":"SEK"}',
    );
    expect(f.totalbelopp).toBe(6081250);
    expect(f.rot_utnyttjat).toBe(1158750);
  });

  it("bara 'Att betala' och ROT-raden: totalbeloppet ar de tva adderade", () => {
    const f = tolkaDokumentsvar(
      '{"summa_fore_rot":null,"att_betala":49225,"rot_utnyttjat":11587.50,"valuta":"SEK"}',
    );
    expect(f.totalbelopp).toBe(6081250);
    expect(f.rot_utnyttjat).toBe(1158750);
  });

  it("underlaget blir det man sjalv betalat, inte ROT draget tva ganger", () => {
    for (const svar of [
      '{"summa_fore_rot":60812.50,"att_betala":49225,"rot_utnyttjat":11587.50}',
      '{"att_betala":49225,"rot_utnyttjat":11587.50}',
    ]) {
      const f = tolkaDokumentsvar(svar);
      expect(f.totalbelopp! - f.rot_utnyttjat!).toBe(4922500);
    }
  });

  it("utan ROT ar totalbeloppet summan att betala", () => {
    expect(tolkaDokumentsvar('{"att_betala":1020.95}').totalbelopp).toBe(102095);
  });

  // Forra omgangen fick summa_fore_rot bli totalbeloppet nar att_betala
  // saknades. Den ar aldrig en kalla langre.
  it("summa_fore_rot ensam blir aldrig totalbeloppet", () => {
    expect(tolkaDokumentsvar('{"summa_fore_rot":1020.95}').totalbelopp).toBe(
      null,
    );
  });

  it("ROT men ingen 'Att betala' ger inget totalbelopp", () => {
    const f = tolkaDokumentsvar(
      '{"summa_fore_rot":60812.50,"rot_utnyttjat":11587.50}',
    );
    expect(f.totalbelopp).toBe(null);
    expect(f.rot_utnyttjat).toBe(1158750);
  });

  it("annan valuta nollar totalbeloppet aven nar det skulle adderas", () => {
    expect(
      tolkaDokumentsvar(
        '{"att_betala":49225,"rot_utnyttjat":11587.50,"valuta":"EUR"}',
      ).totalbelopp,
    ).toBe(null);
  });
});

// Avlasningen laser, den raknar aldrig (CLAUDE.md). Modellen laser fler tal
// an som behovs – netto, moms, summa_fore_rot – och de provas mot att_betala +
// rot_utnyttjat. Skiljer tva vagar till samma summa med mer an oresavrundning
// lamnas beloppet tomt: ett tomt falt syns, 61 812,50 i stallet for 60 812,50
// gor det inte. Datum och leverantor fylls i som vanligt.

const FAKTURAN = {
  datum: "2026-09-01",
  leverantor: "K-Bygg Sverige AB",
  valuta: "SEK",
  att_betala: 49225.0,
  rot_utnyttjat: 11587.5,
  netto: 48650.0,
  moms: 12162.5,
};

function svar(falt: Record<string, unknown>): string {
  return JSON.stringify(falt);
}

describe("tolkaDokumentsvar: de lasta talen kontrollerar varandra", () => {
  it("modellens egen felrakning i summa_fore_rot: 60 812,50 och avvikelsen rapporteras", () => {
    const t = tolkaDokumentsvarMedKontroll(
      svar({ ...FAKTURAN, summa_fore_rot: 61812.5 }),
    );
    expect(t.falt.totalbelopp).toBe(6081250);
    expect(t.avvikelser).toEqual(["summa_fore_rot avviker"]);
  });

  it("utan summa_fore_rot: 60 812,50 och ingen rapport", () => {
    const t = tolkaDokumentsvarMedKontroll(svar(FAKTURAN));
    expect(t.falt.totalbelopp).toBe(6081250);
    expect(avlasningsrapporter(t)).toEqual([]);
  });

  it("summa_fore_rot som stammer: 60 812,50 och ingen rapport", () => {
    const t = tolkaDokumentsvarMedKontroll(
      svar({ ...FAKTURAN, summa_fore_rot: 60812.5 }),
    );
    expect(t.falt.totalbelopp).toBe(6081250);
    expect(avlasningsrapporter(t)).toEqual([]);
  });

  it("felläst nettorad: beloppet lamnas tomt, datum och leverantor fylls i", () => {
    const t = tolkaDokumentsvarMedKontroll(svar({ ...FAKTURAN, netto: 49650.0 }));
    expect(t.falt).toEqual({
      datum: "2026-09-01",
      totalbelopp: null,
      leverantor: "K-Bygg Sverige AB",
      rot_utnyttjat: 1158750,
    });
    expect(t.avvikelser).toEqual(["netto+moms ≠ att_betala+rot"]);
  });

  it("faktura utan ROT: totalbeloppet ar att betala, och netto + moms stammer", () => {
    const t = tolkaDokumentsvarMedKontroll(
      svar({ att_betala: 1250.0, netto: 1000.0, moms: 250.0, valuta: "SEK" }),
    );
    expect(t.falt.totalbelopp).toBe(125000);
    expect(t.avvikelser).toEqual([]);
  });

  it("faktura utan ROT dar netto + moms inte stammer: beloppet lamnas tomt", () => {
    const t = tolkaDokumentsvarMedKontroll(
      svar({ att_betala: 1250.0, netto: 1100.0, moms: 250.0 }),
    );
    expect(t.falt.totalbelopp).toBe(null);
    expect(t.avvikelser).toEqual(["netto+moms ≠ att_betala+rot"]);
  });

  it("butikskvitto med bara en totalsumma: ingen kontroll, ingen rapport", () => {
    const t = tolkaDokumentsvarMedKontroll(
      '{"datum":"2026-08-22","att_betala":1020.95,"valuta":"SEK","leverantor":"Bauhaus Bromma"}',
    );
    expect(t.falt.totalbelopp).toBe(102095);
    expect(avlasningsrapporter(t)).toEqual([]);
  });

  it("butikskvitto med momsrad men utan netto: ingen kontroll att gora", () => {
    const t = tolkaDokumentsvarMedKontroll(
      '{"att_betala":1020.95,"moms":204.19}',
    );
    expect(t.falt.totalbelopp).toBe(102095);
    expect(t.avvikelser).toEqual([]);
  });

  it("oresavrundning till hela kronor ar ingen avvikelse", () => {
    const t = tolkaDokumentsvarMedKontroll(
      svar({ att_betala: 1021.0, netto: 816.76, moms: 204.19 }),
    );
    expect(t.falt.totalbelopp).toBe(102100);
    expect(t.avvikelser).toEqual([]);
  });

  it("mer an oresavrundning ar en avvikelse", () => {
    const t = tolkaDokumentsvarMedKontroll(
      svar({ att_betala: 1021.0, netto: 816.0, moms: 204.19 }),
    );
    expect(t.falt.totalbelopp).toBe(null);
  });

  // summa_fore_rot ar modellens eget rakneresultat, inte ett tryckt tal – den
  // vager inte ensam. Ett tomt belopp har skulle leda anvandaren att skriva in
  // slutsumman efter ROT, och underlaget blir for lagt med hela ROT-beloppet.
  it("summa_fore_rot avviker utan netto och moms: att betala plus ROT galler, avvikelsen rapporteras", () => {
    const t = tolkaDokumentsvarMedKontroll(
      '{"att_betala":49225,"rot_utnyttjat":11587.50,"summa_fore_rot":61812.50}',
    );
    expect(t.falt.totalbelopp).toBe(6081250);
    expect(avlasningsrapporter(t)).toEqual([
      "Dokumentavläsning: summa_fore_rot avviker",
    ]);
  });

  it("netto + moms avviker: tomt aven nar summa_fore_rot ocksa avviker", () => {
    const t = tolkaDokumentsvarMedKontroll(
      svar({ ...FAKTURAN, netto: 49650.0, summa_fore_rot: 61812.5 }),
    );
    expect(t.falt.totalbelopp).toBe(null);
    expect(t.avvikelser).toEqual([
      "netto+moms ≠ att_betala+rot",
      "summa_fore_rot avviker",
    ]);
  });

  it("annan valuta: inga belopp och darmed inga avvikelser", () => {
    const t = tolkaDokumentsvarMedKontroll(
      svar({ ...FAKTURAN, valuta: "EUR", netto: 1 }),
    );
    expect(t.falt.totalbelopp).toBe(null);
    expect(t.avvikelser).toEqual([]);
  });
});

// Rapporten till Sentry bar bara namnet pa kontrollen – aldrig tal,
// leverantor eller svarstext (produktspec avsnitt 13).

describe("avlasningsrapporter", () => {
  it("en avvikelse rapporteras utan ett enda tal eller leverantorsnamn", () => {
    const rapporter = avlasningsrapporter(
      tolkaDokumentsvarMedKontroll(svar({ ...FAKTURAN, netto: 49650.0 })),
    );
    expect(rapporter).toHaveLength(1);
    expect(rapporter[0]).toContain("netto+moms ≠ att_betala+rot");
    expect(rapporter[0]).not.toMatch(/\d/);
    expect(rapporter[0]).not.toContain("K-Bygg");
  });

  it("ett svar utan JSON rapporteras som obrukbart", () => {
    const t = tolkaDokumentsvarMedKontroll("Jag kan tyvärr inte läsa bilden.");
    expect(t.tolkbart).toBe(false);
    expect(t.falt).toEqual(TOMT_DOKUMENTFALT);
    expect(avlasningsrapporter(t)).toEqual([
      "Dokumentavläsning: modellens svar gick inte att tolka",
    ]);
  });

  it("trasig JSON rapporteras som obrukbar", () => {
    expect(
      avlasningsrapporter(tolkaDokumentsvarMedKontroll('{"datum":"2026-08-22", "att_betala":')),
    ).toHaveLength(1);
  });

  it("ett tolkbart svar dar inget falt gick att lasa rapporteras inte", () => {
    const t = tolkaDokumentsvarMedKontroll('{"datum":null,"att_betala":null}');
    expect(t.tolkbart).toBe(true);
    expect(avlasningsrapporter(t)).toEqual([]);
  });
});
