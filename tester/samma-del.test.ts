import { describe, expect, it } from "vitest";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import { reparationsfonsterForklaring, troskelForklaring } from "@/doman/regeltext";
import {
  SAMMA_DEL_SKAL,
  sammaDelStatus,
  sammaDelSvarsfel,
} from "@/doman/samma-del";
import type { Bostad, Projekt } from "@/doman/typer";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// Samma del av bostaden gjord om mer an en gang (CLAUDE.md, "Samma
// byggnadsdel reparerad två gånger", och steg 3). Bara den senaste utgiften
// far dras av. En markerad atgard far reparationsunderlaget noll med sitt
// skal; grundforbattringen rors inte; nollan ligger FORE troskeln; och fragan
// stalls bara nar minst tva atgarder har reparationsunderlag kvar efter steg 3.
//
// Det vantade talet raknas ur samma kalla som koden: varje fall jamfors med
// samma underlag utan markeringen, inte med en konstant.

const SALD = "2026-06-01";

function bostad(over: Partial<Bostad> = {}): Bostad {
  return {
    upplatelseform: "fastighet",
    tilltradesdatum: "2015-01-01",
    forsaljningsdatum: SALD,
    nybyggd_vid_forvarv: false,
    ...over,
  };
}

function bygg(over: Partial<K6aIndata>): K6aIndata {
  return {
    bostad: bostad(),
    medlemskap: { agarandel: 100 },
    projekt: [],
    kostnader: [],
    kostnader_med_bilaga: [],
    regelparametrar: REGELPARAMETRAR,
    ...over,
  };
}

/** En reparation – utbytt, liknande kvalitet, skick 1 -> 4. */
function reparation(over: Partial<Projekt>): Projekt {
  return projekt({
    atgardstyp: "utbytt",
    battre_kvalitet: false,
    skick_forvarv: 1,
    skick_forsaljning: 4,
    ...over,
  });
}

const fasad2022 = reparation({ id: "p1", namn: "Måla fasaden" });
const fasad2025 = reparation({ id: "p2", namn: "Måla fasaden igen" });
const kostnader = [
  kostnad({ id: "k1", totalbelopp: 3_000_000, betaldatum: "2022-06-01", projekt_id: "p1" }),
  kostnad({ id: "k2", totalbelopp: 4_000_000, betaldatum: "2025-06-01", projekt_id: "p2" }),
];

const rad = (ex: ReturnType<typeof byggK6aExport>, sida: 1 | 2, atgard: string) => {
  const rader = (sida === 1 ? ex.sida1 : ex.sida2).rader.filter((r) => r.atgard === atgard);
  expect(rader, `${atgard} pa sida ${sida}`).toHaveLength(1);
  return rader[0];
};

describe("en markerad åtgärd", () => {
  const utan = byggK6aExport(bygg({ projekt: [fasad2022, fasad2025], kostnader }));
  const med = byggK6aExport(
    bygg({
      projekt: [{ ...fasad2022, tidigare_gang_samma_del: true }, fasad2025],
      kostnader,
    }),
  );

  it("får ingen reparationsdel, med sitt skäl", () => {
    // Utan markeringen har den en avdragsgill del – annars provar testet inget.
    expect(rad(utan, 2, "Måla fasaden").avdragsgill_del_brutto).toBeGreaterThan(0);

    expect(rad(med, 2, "Måla fasaden").avdragsgill_del_brutto).toBe(0);
    expect(rad(med, 2, "Måla fasaden").belopp_brutto).toBe(0);
    expect(rad(med, 2, "Måla fasaden").forklaring).toBe(SAMMA_DEL_SKAL);
  });

  it("beloppet står kvar – nollan hör till den avdragsgilla delen", () => {
    expect(rad(med, 2, "Måla fasaden").kostnad_brutto).toBe(
      rad(utan, 2, "Måla fasaden").kostnad_brutto,
    );
  });

  it("den senaste gången räknas som förut", () => {
    expect(rad(med, 2, "Måla fasaden igen")).toEqual(rad(utan, 2, "Måla fasaden igen"));
  });
});

describe("grundförbättringen rörs inte", () => {
  // Bytt mot battre: merkostnaden ar grundforbattring, resten reparation.
  const battre = reparation({
    id: "p1",
    namn: "Nytt golv",
    battre_kvalitet: true,
    merkostnad: 1_000_000,
  });
  const golv2025 = reparation({ id: "p2", namn: "Nytt golv igen" });
  const utan = byggK6aExport(bygg({ projekt: [battre, golv2025], kostnader }));
  const med = byggK6aExport(
    bygg({ projekt: [{ ...battre, tidigare_gang_samma_del: true }, golv2025], kostnader }),
  );

  it("sida 1 är densamma med och utan markeringen", () => {
    expect(rad(utan, 1, "Nytt golv").belopp_brutto).toBeGreaterThan(0);
    expect(rad(med, 1, "Nytt golv")).toEqual(rad(utan, 1, "Nytt golv"));
    expect(med.ruta4_brutto).toBe(utan.ruta4_brutto);
  });

  it("medan reparationsdelen på sida 2 faller", () => {
    expect(rad(utan, 2, "Nytt golv").avdragsgill_del_brutto).toBeGreaterThan(0);
    expect(rad(med, 2, "Nytt golv").avdragsgill_del_brutto).toBe(0);
  });
});

describe("nollan ligger före tröskeln", () => {
  // 2023: en reparation pa 3 000 kr (markerad) och en tillbyggnad pa 2 500 kr.
  // Tillsammans 5 500 kr – over troskeln om reparationen fick vara med, under
  // den nar den aldrig var avdragsgill.
  const malning2023 = reparation({ id: "p1", namn: "Måla fasaden" });
  const malning2025 = reparation({ id: "p2", namn: "Måla fasaden igen" });
  const tillbyggnad = projekt({ id: "p3", namn: "Altan", atgardstyp: "nybyggnad" });
  const k = [
    kostnad({ id: "k1", totalbelopp: 300_000, betaldatum: "2023-06-01", projekt_id: "p1" }),
    kostnad({ id: "k2", totalbelopp: 4_000_000, betaldatum: "2025-06-01", projekt_id: "p2" }),
    kostnad({ id: "k3", totalbelopp: 250_000, betaldatum: "2023-08-01", projekt_id: "p3" }),
  ];
  const projektlista = (markerad: boolean) => [
    { ...malning2023, tidigare_gang_samma_del: markerad },
    malning2025,
    tillbyggnad,
  ];

  it("utan markeringen passerar 2023 tröskeln", () => {
    const ex = byggK6aExport(bygg({ projekt: projektlista(false), kostnader: k }));
    expect(rad(ex, 1, "Altan").belopp_brutto).toBe(250_000);
  });

  it("med markeringen faller hela 2023 – den bortmarkerade målningen lyfter inte året", () => {
    const ex = byggK6aExport(bygg({ projekt: projektlista(true), kostnader: k }));
    expect(rad(ex, 1, "Altan").belopp_brutto).toBe(0);
    expect(rad(ex, 1, "Altan").forklaring).toBe(
      troskelForklaring(slaUppRegelparameter(REGELPARAMETRAR, "troskelbelopp", "2023-12-31")),
    );
    // Malningens nolla bar sitt eget skal, inte troskelns.
    expect(rad(ex, 2, "Måla fasaden").forklaring).toBe(SAMMA_DEL_SKAL);
  });
});

describe("vem som får frågan", () => {
  it("två åtgärder med reparationsunderlag efter steg 3: frågan ställs", () => {
    const ex = byggK6aExport(bygg({ projekt: [fasad2022, fasad2025], kostnader }));
    expect(ex.samma_del_kandidater).toEqual(["p1", "p2"]);
    expect(ex.samma_del).toBe("obesvarad");
  });

  it("den ena utanför femårsfönstret: bara en kvar, frågan ställs inte", () => {
    const k = [
      kostnad({ id: "k1", totalbelopp: 3_000_000, betaldatum: "2019-06-01", projekt_id: "p1" }),
      kostnad({ id: "k2", totalbelopp: 4_000_000, betaldatum: "2025-06-01", projekt_id: "p2" }),
    ];
    const ex = byggK6aExport(bygg({ projekt: [fasad2022, fasad2025], kostnader: k }));
    expect(ex.samma_del_kandidater).toEqual(["p2"]);
    expect(ex.samma_del).toBe("visas_inte");
  });

  it("nybyggd vid förvärvet: ingen reparationsdel, ingen fråga", () => {
    const ex = byggK6aExport(
      bygg({
        bostad: bostad({ nybyggd_vid_forvarv: true }),
        projekt: [fasad2022, fasad2025],
        kostnader,
      }),
    );
    expect(ex.samma_del_kandidater).toEqual([]);
    expect(ex.samma_del).toBe("visas_inte");
  });

  it("en ren grundförbättring är ingen kandidat", () => {
    const ex = byggK6aExport(
      bygg({
        projekt: [projekt({ id: "p1", namn: "Altan", atgardstyp: "nybyggnad" }), fasad2025],
        kostnader,
      }),
    );
    expect(ex.samma_del_kandidater).toEqual(["p2"]);
    expect(ex.samma_del).toBe("visas_inte");
  });

  it("före försäljningen ställs frågan inte", () => {
    const ex = byggK6aExport(
      bygg({ bostad: bostad({ forsaljningsdatum: null }), projekt: [fasad2022, fasad2025], kostnader }),
    );
    expect(ex.samma_del).toBe("visas_inte");
  });

  it("markeringen ändrar inte urvalet – annars vore varje svar inaktuellt direkt", () => {
    const ex = byggK6aExport(
      bygg({
        bostad: bostad({ samma_del_besvarad_for: ["p1", "p2"] }),
        projekt: [{ ...fasad2022, tidigare_gang_samma_del: true }, fasad2025],
        kostnader,
      }),
    );
    expect(ex.samma_del_kandidater).toEqual(["p1", "p2"]);
    expect(ex.samma_del).toBe("aktuell");
  });
});

describe("ingen nolla får två skäl", () => {
  it("en markering på något som redan fallit på femårsfönstret behåller fönstrets skäl", () => {
    // Kan inte uppsta via appen – fragan visar den inte – men en gammal
    // markering kan ligga kvar om forsaljningsdatumet andrats.
    const k = [
      kostnad({ id: "k1", totalbelopp: 3_000_000, betaldatum: "2019-06-01", projekt_id: "p1" }),
      kostnad({ id: "k2", totalbelopp: 4_000_000, betaldatum: "2025-06-01", projekt_id: "p2" }),
    ];
    const ex = byggK6aExport(
      bygg({ projekt: [{ ...fasad2022, tidigare_gang_samma_del: true }, fasad2025], kostnader: k }),
    );
    expect(rad(ex, 2, "Måla fasaden").forklaring).toBe(
      reparationsfonsterForklaring(
        slaUppRegelparameter(REGELPARAMETRAR, "reparationsfonster_ar", SALD),
      ),
    );
  });
});

describe("ett inaktuellt svar är ofullständigt, inte ogiltigt", () => {
  const ny = reparation({ id: "p3", namn: "Byta fönster" });
  const k = [
    ...kostnader,
    kostnad({ id: "k3", totalbelopp: 2_000_000, betaldatum: "2024-06-01", projekt_id: "p3" }),
  ];

  it("en ny åtgärd: svaret är ändrat, men markeringen gäller fortfarande", () => {
    const ex = byggK6aExport(
      bygg({
        bostad: bostad({ samma_del_besvarad_for: ["p1", "p2"] }),
        projekt: [{ ...fasad2022, tidigare_gang_samma_del: true }, fasad2025, ny],
        kostnader: k,
      }),
    );
    expect(ex.samma_del).toBe("andrad");
    expect(rad(ex, 2, "Måla fasaden").avdragsgill_del_brutto).toBe(0);
    expect(rad(ex, 2, "Måla fasaden").forklaring).toBe(SAMMA_DEL_SKAL);
  });

  it("den senare raderad: den markerade står kvar nollad, och frågan går att nå för att ändra", () => {
    const ex = byggK6aExport(
      bygg({
        bostad: bostad({ samma_del_besvarad_for: ["p1", "p2"] }),
        projekt: [{ ...fasad2022, tidigare_gang_samma_del: true }],
        kostnader: [kostnader[0]],
      }),
    );
    expect(rad(ex, 2, "Måla fasaden").avdragsgill_del_brutto).toBe(0);
    expect(ex.samma_del).toBe("andrad");
  });
});

describe("tillståndet", () => {
  it("jämför id:n, inte antal", () => {
    expect(
      sammaDelStatus({ kandidater: ["a", "c"], markerade: [], besvaradFor: ["a", "b"] }),
    ).toBe("andrad");
    expect(
      sammaDelStatus({ kandidater: ["b", "a"], markerade: [], besvaradFor: ["a", "b"] }),
    ).toBe("aktuell");
  });

  it("en enda kandidat utan markering: visas inte, även om ett gammalt svar finns", () => {
    expect(
      sammaDelStatus({ kandidater: ["a"], markerade: [], besvaradFor: ["a", "b"] }),
    ).toBe("visas_inte");
  });
});

describe("svaret prövas", () => {
  const kandidater = ["a", "b", "c"];
  it("nej är alltid ett svar", () => {
    expect(sammaDelSvarsfel({ ja: false, markerade: [], kandidater })).toBeNull();
  });
  it("ja utan markering säger inget", () => {
    expect(sammaDelSvarsfel({ ja: true, markerade: [], kandidater })).toBe(
      "Markera de tidigare gångerna, eller svara nej.",
    );
  });
  it("alla markerade går inte – någon är den senaste", () => {
    expect(sammaDelSvarsfel({ ja: true, markerade: ["a", "b", "c"], kandidater })).toBe(
      "Den senaste gången lämnar du omarkerad.",
    );
  });
  it("en markering utanför kandidaterna avvisas", () => {
    expect(sammaDelSvarsfel({ ja: true, markerade: ["x"], kandidater })).toBe(
      "Ett av projekten går inte att markera längre. Ladda om sidan och svara igen.",
    );
  });
  it("de äldre markerade, den senaste kvar", () => {
    expect(sammaDelSvarsfel({ ja: true, markerade: ["a", "b"], kandidater })).toBeNull();
  });
});
