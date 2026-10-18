import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DatumFalt } from "@/components/datum-falt";
import {
  DAMPAD_DIALOGVAG_KLASS,
  DIALOGSVAR_KLASS,
  Falt,
} from "@/components/skarm";
import { datumfel } from "@/lib/datum";
import {
  datumfaltetsMeddelande,
  nastaStegVidSparande,
} from "@/lib/formularfel";
import { tolkaFragetradetFormData } from "@/lib/fragetradet-formdata";
import { sparfragor, tolkaKostnadsformular } from "@/lib/kostnadsformular";

// docs/design.md, "När ett formulär vägrar": ett formulär som inte sparar ska
// säga varför, varje gång, på samma sätt. Fallen är de som mättes på
// /kostnad/nytt i produktionen 2026-10-18.

function inmatning(falt: Record<string, string>): FormData {
  const fd = new FormData();
  const alla = {
    totalbelopp: "",
    rot_utnyttjat: "",
    dokumentdatum: "",
    betaldatum: "",
    leverantor: "",
    anteckning: "",
    ...falt,
  };
  for (const [k, v] of Object.entries(alla)) fd.set(k, v);
  return fd;
}

function felen(fd: FormData) {
  const t = tolkaKostnadsformular(fd);
  return "felen" in t ? t.felen : [];
}

describe("inmatningen – varje avvisning har en mening", () => {
  it("ett tomt formulär ger en mening för varje tomt obligatoriskt fält, i skärmens ordning", () => {
    expect(felen(inmatning({}))).toEqual([
      {
        falt: "totalbelopp",
        fel: "Fyll i ett belopp större än noll, t.ex. 1 020,95.",
      },
      { falt: "dokumentdatum", fel: "Fyll i kvittots datum." },
      { falt: "leverantor", fel: "Fyll i leverantör." },
    ]);
  });

  it("varje fel har en icke-tom mening", () => {
    for (const f of felen(inmatning({}))) expect(f.fel.trim()).not.toBe("");
  });

  it("ett ifyllt formulär godtas", () => {
    const t = tolkaKostnadsformular(
      inmatning({
        totalbelopp: "45 250,00",
        dokumentdatum: "2019-05-08",
        betaldatum: "2019-05-08",
        leverantor: "Golvproffsen i Solna",
      }),
    );
    expect("felen" in t).toBe(false);
  });

  it("ROT över totalbeloppet avvisas vid ROT-fältet", () => {
    expect(
      felen(
        inmatning({
          totalbelopp: "1 000",
          rot_utnyttjat: "2 000",
          dokumentdatum: "2026-01-01",
          betaldatum: "2026-01-01",
          leverantor: "X",
        }),
      ),
    ).toEqual([
      {
        falt: "rot_utnyttjat",
        fel: "ROT-avdraget kan inte vara större än totalbeloppet.",
      },
    ]);
  });
});

describe("inmatningen – ett fel ger ett meddelande", () => {
  it("2026-02-31: fältets eget fel vinner, 'Fyll i kvittots datum.' visas inte", () => {
    const egetFel = datumfel("2026", "02", "31");
    expect(egetFel).toBe("Ogiltig dag.");
    // Datumfältet rapporterar "" för ett ogiltigt datum, så formuläret
    // underkänner det som tomt …
    const formularetsFel = felen(inmatning({ leverantor: "X", totalbelopp: "1" }))
      .find((f) => f.falt === "dokumentdatum")?.fel;
    expect(formularetsFel).toBe("Fyll i kvittots datum.");
    // … men fältet visar bara ett av dem, och det sanna.
    expect(datumfaltetsMeddelande(egetFel, formularetsFel)).toBe("Ogiltig dag.");
  });

  it("ett tomt datum får formulärets mening", () => {
    expect(datumfaltetsMeddelande(null, "Fyll i kvittots datum.")).toBe(
      "Fyll i kvittots datum.",
    );
  });

  it("utan fel visas ingenting", () => {
    expect(datumfaltetsMeddelande(null, undefined)).toBeNull();
  });
});

describe("meddelandet meddelas, inte bara visas", () => {
  it("ett fält med fel bär role=\"alert\" och ersätter hjälptexten", () => {
    const html = renderToStaticMarkup(
      createElement(Falt, {
        etikett: "Leverantör",
        hjalp: "Hjälptext",
        fel: "Fyll i leverantör.",
        children: createElement("input"),
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Fyll i leverantör.");
    expect(html).not.toContain("Hjälptext");
  });

  it("ett fält utan fel har ingen alert", () => {
    const html = renderToStaticMarkup(
      createElement(Falt, {
        etikett: "Leverantör",
        hjalp: "Hjälptext",
        children: createElement("input"),
      }),
    );
    expect(html).not.toContain('role="alert"');
  });

  it("datumfältet med formulärets fel: alert, aria-invalid och fokusmarkering", () => {
    const html = renderToStaticMarkup(
      createElement(DatumFalt, { fel: "Fyll i kvittots datum." }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Fyll i kvittots datum.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("data-faltfel");
  });
});

describe("dialoger om sparandet körs efter valideringen", () => {
  it("ett ogiltigt formulär utan bilaga visar felen – inte 'Inget kvitto bifogat'", () => {
    expect(
      nastaStegVidSparande({ antalFel: 1, obesvaradeFragor: ["bilaga"] }),
    ).toEqual({ steg: "visa-fel" });
  });

  it("ett ogiltigt formulär daterat före tillträdet visar felen – inte tillträdesfrågan", () => {
    expect(
      nastaStegVidSparande({
        antalFel: 1,
        obesvaradeFragor: ["tilltrade", "bilaga"],
      }),
    ).toEqual({ steg: "visa-fel" });
  });

  it("ett giltigt formulär utan bilaga ställer frågan", () => {
    expect(
      nastaStegVidSparande({ antalFel: 0, obesvaradeFragor: ["bilaga"] }),
    ).toEqual({ steg: "stall-fragan", fraga: "bilaga" });
  });

  it("frågorna ställs en i taget, i turordning", () => {
    expect(
      nastaStegVidSparande({
        antalFel: 0,
        obesvaradeFragor: ["tilltrade", "bilaga"],
      }),
    ).toEqual({ steg: "stall-fragan", fraga: "tilltrade" });
  });

  it("ett giltigt formulär utan obesvarade frågor sparas", () => {
    expect(
      nastaStegVidSparande({ antalFel: 0, obesvaradeFragor: [] }),
    ).toEqual({ steg: "spara" });
  });
});

describe("frågeträdet – felet står vid frågan det gäller", () => {
  function fd(falt: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(falt)) f.set(k, v);
    return f;
  }

  it("tomt namn pekar ut fråga 1", () => {
    expect(tolkaFragetradetFormData(fd({}))).toEqual({
      fel: "Skriv vad du gjorde.",
      falt: "namn",
    });
  });

  it("obesvarad fråga 2 pekar ut den", () => {
    expect(tolkaFragetradetFormData(fd({ namn: "Golv" }))).toEqual({
      fel: "Svara på om du byggde något nytt.",
      falt: "byggde_nytt",
    });
  });

  it("bättre kvalitet utan merkostnad pekar ut merkostnaden", () => {
    const t = tolkaFragetradetFormData(
      fd({
        namn: "Golv",
        byggde_nytt: "nej",
        andrade_planlosning: "nej",
        nytt_eller_bytt: "bytt",
        battre_eller_liknande: "battre",
        merkostnad: "",
      }),
    );
    expect(t).toMatchObject({ falt: "merkostnad" });
  });

  it("saknat skick vid förvärvet pekar ut fråga 6", () => {
    const t = tolkaFragetradetFormData(
      fd({
        namn: "Golv",
        byggde_nytt: "nej",
        andrade_planlosning: "nej",
        nytt_eller_bytt: "bytt",
        battre_eller_liknande: "liknande",
      }),
    );
    expect(t).toMatchObject({ falt: "skick_forvarv" });
  });
});

describe("dialogernas svar följer 44 px-regeln", () => {
  it("svaren i en raderingsbekräftelse är 44 px höga och delar raden", () => {
    expect(DIALOGSVAR_KLASS).toContain("min-h-[44px]");
    expect(DIALOGSVAR_KLASS).toContain("flex-1");
  });

  it("'Spara ändå' är 44 px hög och radens bredd", () => {
    expect(DAMPAD_DIALOGVAG_KLASS).toContain("min-h-[44px]");
    expect(DAMPAD_DIALOGVAG_KLASS).toContain("w-full");
  });

  it("ingen av dem är orange", () => {
    expect(DIALOGSVAR_KLASS).not.toContain("accent");
    expect(DAMPAD_DIALOGVAG_KLASS).not.toContain("accent");
  });
});

describe("bekräftelsen vid sparandet – före tillträdet", () => {
  const BAS = {
    tilltradesdatum: "2022-02-02",
    bekraftatKvittodatum: null,
    harBilaga: true,
    bilagaBekraftad: false,
  };

  it("2019-05-08 mot tillträde 2022-02-02 ställer frågan", () => {
    expect(sparfragor({ ...BAS, kvittodatum: "2019-05-08" })).toEqual([
      "tilltrade",
    ]);
  });

  it("ett datum efter tillträdet ställer ingen fråga", () => {
    expect(sparfragor({ ...BAS, kvittodatum: "2023-01-01" })).toEqual([]);
  });

  it("bara den undre gränsen – ett datum långt fram ställer ingen fråga", () => {
    expect(sparfragor({ ...BAS, kvittodatum: "2099-01-01" })).toEqual([]);
  });

  it("ett ofullständigt datum ställer ingen fråga – fältvalideringen tar det", () => {
    expect(sparfragor({ ...BAS, kvittodatum: "" })).toEqual([]);
  });

  it("'Datumet stämmer' sparar: samma datum frågas inte igen", () => {
    expect(
      sparfragor({
        ...BAS,
        kvittodatum: "2019-05-08",
        bekraftatKvittodatum: "2019-05-08",
      }),
    ).toEqual([]);
  });

  it("ändras datumet till ett annat före tillträdet frågas det igen", () => {
    expect(
      sparfragor({
        ...BAS,
        kvittodatum: "2018-05-08",
        bekraftatKvittodatum: "2019-05-08",
      }),
    ).toEqual(["tilltrade"]);
  });

  it("utan bilaga: tillträdesfrågan först, sedan bilagan", () => {
    expect(
      sparfragor({ ...BAS, harBilaga: false, kvittodatum: "2019-05-08" }),
    ).toEqual(["tilltrade", "bilaga"]);
  });

  it("utan bilaga: 'Datumet stämmer' sparar direkt, utan en fråga till", () => {
    expect(
      sparfragor({
        ...BAS,
        harBilaga: false,
        kvittodatum: "2019-05-08",
        bekraftatKvittodatum: "2019-05-08",
      }),
    ).toEqual([]);
  });

  it("efter fältvalideringen: ett ogiltigt formulär ställer ingen av frågorna", () => {
    expect(
      nastaStegVidSparande({
        antalFel: 1,
        obesvaradeFragor: sparfragor({
          ...BAS,
          harBilaga: false,
          kvittodatum: "2019-05-08",
        }),
      }),
    ).toEqual({ steg: "visa-fel" });
  });
});
