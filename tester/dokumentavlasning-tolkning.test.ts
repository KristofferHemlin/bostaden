import { describe, expect, it } from "vitest";
import {
  TOMT_DOKUMENTFALT,
  tolkaDokumentsvar,
} from "@/lib/dokumentavlasning/tolkning";

// Dokumentavlasningen (produktspec avsnitt 9) skickar kvittot till en sprakmodell
// och far tillbaka tre falt: datum, totalbelopp inklusive moms och leverantor.
// Modellsvaret ar text och ska tolkas DEFENSIVT: saknade eller olasbara falt blir
// null, aldrig en gissning. Ett gissat belopp som hamnar i ett deklarations-
// underlag ar det varsta felet appen kan gora – darfor testas parsningen fore
// implementationen och tacker varje satt svaret kan vara trasigt pa.

describe("tolkaDokumentsvar: rent modellsvar", () => {
  it("tolkar ett rent JSON-objekt med alla tre falt", () => {
    const svar = '{"datum":"2026-08-22","totalbelopp":1020.95,"leverantor":"Bauhaus Bromma"}';
    expect(tolkaDokumentsvar(svar)).toEqual({
      datum: "2026-08-22",
      totalbelopp: 102095,
      leverantor: "Bauhaus Bromma",
    });
  });

  it("tolkar JSON inne i ett ```json-kodstaket", () => {
    const svar = "```json\n{\n  \"datum\": \"2026-08-22\",\n  \"totalbelopp\": 1020.95,\n  \"leverantor\": \"Bauhaus\"\n}\n```";
    expect(tolkaDokumentsvar(svar)).toEqual({
      datum: "2026-08-22",
      totalbelopp: 102095,
      leverantor: "Bauhaus",
    });
  });

  it("tolkar JSON aven med omkringliggande text fran modellen", () => {
    const svar =
      'Har ar uppgifterna jag kunde lasa ut:\n{"datum":"2026-08-22","totalbelopp":499,"leverantor":"Clas Ohlson"}\nHor av dig om nagot ser fel ut.';
    expect(tolkaDokumentsvar(svar)).toEqual({
      datum: "2026-08-22",
      totalbelopp: 49900,
      leverantor: "Clas Ohlson",
    });
  });
});

describe("tolkaDokumentsvar: trasiga eller tomma svar ger inga gissningar", () => {
  it("trasig JSON ger alla falt null", () => {
    expect(tolkaDokumentsvar('{"datum":"2026-08-22", "totalbelopp":')).toEqual(
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
    });
  });

  it("falt satt till null i JSON forblir null", () => {
    expect(
      tolkaDokumentsvar(
        '{"datum":null,"totalbelopp":null,"leverantor":null}',
      ),
    ).toEqual(TOMT_DOKUMENTFALT);
  });
});

describe("tolkaDokumentsvar: datum", () => {
  it("giltigt YYYY-MM-DD behalls oforandrat", () => {
    expect(tolkaDokumentsvar('{"datum":"2015-03-07"}').datum).toBe("2015-03-07");
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
    expect(tolkaDokumentsvar('{"totalbelopp":1020.95}').totalbelopp).toBe(
      102095,
    );
  });

  it("heltal tolkas som kronor", () => {
    expect(tolkaDokumentsvar('{"totalbelopp":499}').totalbelopp).toBe(49900);
  });

  it("belopp som svensk strang med tusentalsavgransare tolkas till oren", () => {
    expect(tolkaDokumentsvar('{"totalbelopp":"1 020,95"}').totalbelopp).toBe(
      102095,
    );
  });

  it("belopp med kr-suffix tolkas anda", () => {
    expect(tolkaDokumentsvar('{"totalbelopp":"1 020,95 kr"}').totalbelopp).toBe(
      102095,
    );
  });

  it("noll ger null (inget kvitto ar pa noll kronor)", () => {
    expect(tolkaDokumentsvar('{"totalbelopp":0}').totalbelopp).toBe(null);
  });

  it("negativt belopp ger null", () => {
    expect(tolkaDokumentsvar('{"totalbelopp":-199}').totalbelopp).toBe(null);
  });

  it("olasbar belopssträng ger null", () => {
    expect(tolkaDokumentsvar('{"totalbelopp":"ca tusen"}').totalbelopp).toBe(
      null,
    );
  });

  it("avrundar oren korrekt vid flyttalsfel", () => {
    expect(tolkaDokumentsvar('{"totalbelopp":19.99}').totalbelopp).toBe(1999);
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
