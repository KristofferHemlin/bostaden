// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Beskedet när ett värde ändrar vilka kvitton som räknas (docs/design.md,
// samma rubrik; CLAUDE.md, "Ett fält som ändrar vilka kvitton som räknas ska
// säga vad det kostar"). Fyra värden: tillträdesdatum, försäljningsdatum
// ändrat efter försäljningen, upplåtelseform före den, och första ägaren –
// i inställningarna och på Frågor om bostaden.
//
// Provet går genom appens egna serverfunktioner mot den falska databasen och
// jämför beskedets tal med det exportvyn visar FÖRE och EFTER sparandet. Det
// är den jämförelsen som avgör: beskedet lovar ett tal, och underlaget ska
// sedan visa det. Talet är skillnaden i underlaget, aldrig summan av de
// kvitton ändringen rör – tröskelfallet nedan är byggt för att de ska skilja
// sig, och prövar först att de gör det.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return { db: skapaFalskDatabas(), Omdirigering, inloggad: null as { id: string; email: string } | null };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/export",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({ auth: { getUser: async () => ({ data: { user: h.inloggad } }) } }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExportSida from "@/app/export/page";
import { sparaBostaden, sparaForvarvet } from "@/app/installningar/actions";
import { markeraSald } from "@/app/forsaljning/actions";
import { sparaFragorOmBostaden } from "@/app/bostaden/fragor/actions";
import { UnderlagsfragaRuta } from "@/components/underlagsfraga";
import { BEKRAFTAD_ANDRING, type Underlagsbesked } from "@/lib/underlagsbesked";

const ANNA = "a0000000-0000-4000-8000-0000000000f3";
const X = "b0000000-0000-4000-8000-0000000000f3";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const kr = (t: string) => t.replace(/ /g, " ");

type Kvitto = [namn: string, atgardstyp: "nybyggnad" | "utbytt", oren: number, dag: string];

function seeda(bostad: Record<string, unknown>, kvitton: Kvitto[]) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"),
    forsaljningsdatum: datum("2026-09-15"), nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: null, ...bostad,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  for (const [namn, typ, belopp, dag] of kvitton) {
    const p = db.lagg("projekt", {
      bostad_id: X, namn, ar: Number(dag.slice(0, 4)), atgardstyp: typ,
      ...(typ === "utbytt" ? { battre_kvalitet: false, skick_forvarv: 1, skick_forsaljning: 4 } : {}),
    });
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Byggmax", anteckning: namn, totalbelopp: belopp, dokumentdatum: datum(dag), betaldatum: datum(dag),
    });
    const r = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: namn, belopp });
    db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: p.id, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** De två summorna exportvyn visar, i ören, eller null när summan saknas. */
async function exportvyn(): Promise<{ sida1: number | null; sida2: number | null }> {
  const d = document.createElement("div");
  d.innerHTML = renderToStaticMarkup(await ExportSida());
  const summa = (underrad: string) => {
    const p = [...d.querySelectorAll("p")].find((e) => e.textContent === underrad);
    const t = p?.closest("section")?.querySelector(".font-rubrik")?.textContent;
    if (!t) return null;
    const m = kr(t).match(/([\d ]+) kr$/);
    if (!m) throw new Error(`summan "${t}" är inget belopp`);
    return Number(m[1].replace(/ /g, "")) * 100;
  };
  return { sida1: summa("Summa sida 1 – grundförbättringar"), sida2: summa("Summa sida 2 – avdragsgill del efter förslitning") };
}

function fd(f: Record<string, string>) {
  const x = new FormData();
  for (const [k, v] of Object.entries(f)) x.append(k, v);
  return x;
}
const forvarvet = (f: Record<string, string>) =>
  fd({ tilltradesdatum: "", kopeskilling: "", kopkostnader: "", agarandel: "", forsta_agare: "nej", ...f });
const bostaden = (upplatelseform: string) =>
  fd({ upplatelseform, adress: "Storgatan 1", ort: "", storlek: "", identifiering: "", kapitaltillskott: "" });
const bekraftad = (data: FormData, b: Underlagsbesked) => {
  data.set(BEKRAFTAD_ANDRING, b.bekraftelse);
  return data;
};
const sparatTilltrade = async () =>
  ((await h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } })).tilltradesdatum as Date).toISOString().slice(0, 10);

// Villan ur mätningen 2026-11-24: 2019 har förråd 2 000 kr och altan
// 4 000 kr, tillsammans över tröskeln; 2024 ett plank på 10 000 kr.
const TRÖSKELFALLET: Kvitto[] = [
  ["Förråd", "nybyggnad", 200_000, "2019-07-01"],
  ["Altan", "nybyggnad", 400_000, "2019-09-01"],
  ["Plank", "nybyggnad", 1_000_000, "2024-05-01"],
];
const FÖRRÅDET = 200_000;

describe("tillträdet flyttas", () => {
  it("framåt: beskedet kommer i stället för sparandet, och ingenting sparas", async () => {
    seeda({}, TRÖSKELFALLET);
    const svar = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-08-01" }));
    expect(svar.fel).toBeUndefined();
    expect(svar.underlag, "beskedet").toBeDefined();
    expect(await sparatTilltrade()).toBe("2019-06-01");
  });

  it("talet är underlagets skillnad, inte kvittots: 2 000 kr i kvitton, 6 000 kr i skillnad", async () => {
    seeda({}, TRÖSKELFALLET);
    const fore = await exportvyn();
    const svar = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-08-01" }));
    const [sida1] = svar.underlag!.summor;
    expect(sida1).toEqual({ sida: 1, fore: fore.sida1, efter: expect.any(Number) });
    // Förutsättningen: i det här fallet skiljer sig de två talen.
    expect(sida1.fore - sida1.efter, "underlaget sjunker mer än kvittot").not.toBe(FÖRRÅDET);
    // Och beskedets tal är det exportvyn visar när ändringen är sparad.
    await sparaForvarvet({}, bekraftad(forvarvet({ tilltradesdatum: "2019-08-01" }), svar.underlag!));
    expect((await exportvyn()).sida1).toBe(sida1.efter);
    expect(sida1.fore - sida1.efter).toBe(600_000);
  });

  it("orsakerna: ett kvitto utanför innehavet och ett år under tröskeln", async () => {
    seeda({}, TRÖSKELFALLET);
    const svar = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-08-01" }));
    expect(svar.underlag).toMatchObject({ kvittonUtanforInnehavet: 1, arUnderTroskeln: { antal: 1, troskelbelopp: 500_000 } });
  });

  it("Spara ändå sparar: samma värden med bekräftelsen går igenom", async () => {
    seeda({}, TRÖSKELFALLET);
    const forst = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-08-01" }));
    const sedan = await sparaForvarvet({}, bekraftad(forvarvet({ tilltradesdatum: "2019-08-01" }), forst.underlag!));
    expect(sedan).toEqual({});
    expect(await sparatTilltrade()).toBe("2019-08-01");
  });

  it("en bekräftelse av andra värden sparar inte: ändrar hon datumet efter Avbryt frågar appen igen", async () => {
    seeda({}, TRÖSKELFALLET);
    const forst = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-08-01" }));
    const igen = await sparaForvarvet({}, bekraftad(forvarvet({ tilltradesdatum: "2019-10-01" }), forst.underlag!));
    expect(igen.underlag, "nytt besked").toBeDefined();
    expect(await sparatTilltrade()).toBe("2019-06-01");
  });

  it("bakåt: underlaget växer, och beskedet kommer ändå – det är den farliga riktningen", async () => {
    seeda({ tilltradesdatum: datum("2019-08-01") }, TRÖSKELFALLET);
    const fore = await exportvyn();
    const svar = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-06-01" }));
    const [sida1] = svar.underlag!.summor;
    expect(sida1.fore).toBe(fore.sida1);
    expect(sida1.efter).toBeGreaterThan(sida1.fore);
    expect(sida1.efter - sida1.fore).toBe(600_000);
  });

  it("ett oförändrat datum ger inget besked – kortet skickar alltid datumet, och köpeskillingen sparas direkt", async () => {
    seeda({}, TRÖSKELFALLET);
    const svar = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-06-01", kopeskilling: "3 000 000" }));
    expect(svar).toEqual({});
  });

  it("ett flyttat datum som inte flyttar något tal ger inget besked", async () => {
    seeda({}, TRÖSKELFALLET);
    const svar = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-06-20" }));
    expect(svar).toEqual({});
    expect(await sparatTilltrade()).toBe("2019-06-20");
  });

  it("utan ett enda kvitto finns inget underlag att flytta, och inget besked", async () => {
    seeda({}, []);
    expect(await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-08-01" }))).toEqual({});
  });
});

describe("försäljningsdatumet ändras efter försäljningen", () => {
  const FALLET: Kvitto[] = [
    ["Målning", "utbytt", 1_000_000, "2020-05-01"],
    ["Altan", "nybyggnad", 600_000, "2021-06-01"],
  ];

  it("2026 → 2025: målningen från 2020 kommer in i fönstret, sida 2 växer, och beskedet säger det", async () => {
    seeda({ tilltradesdatum: datum("2015-06-01") }, FALLET);
    const fore = await exportvyn();
    const svar = await markeraSald({}, fd({ forsaljningsdatum: "2025-03-01", forsaljningspris: "" }));
    expect(svar.underlag!.summor).toEqual([{ sida: 2, fore: fore.sida2, efter: 600_000 }]);
    await expect(markeraSald({}, bekraftad(fd({ forsaljningsdatum: "2025-03-01", forsaljningspris: "" }), svar.underlag!))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect((await exportvyn()).sida2).toBe(600_000);
  });

  it("den första registreringen av försäljningen ger inget besked – den är försäljningen själv", async () => {
    seeda({ tilltradesdatum: datum("2015-06-01"), forsaljningsdatum: null }, FALLET);
    await expect(markeraSald({}, fd({ forsaljningsdatum: "2026-09-15", forsaljningspris: "" }))).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("upplåtelseformen byts före försäljningen", () => {
  const FALLET: Kvitto[] = [
    ["Tillbyggnad", "nybyggnad", 2_000_000, "1972-05-01"],
    ["Plank", "nybyggnad", 1_000_000, "2024-05-01"],
  ];

  it("fastighet → bostadsrätt: tillbyggnaden från 1972 faller bort, och frågorna om bostaden nollställs", async () => {
    seeda({ tilltradesdatum: datum("1971-01-01"), forsaljningsdatum: null }, FALLET);
    const fore = await exportvyn();
    const svar = await sparaBostaden({}, bostaden("bostadsratt"));
    expect(svar.underlag).toMatchObject({
      summor: [{ sida: 1, fore: fore.sida1, efter: 1_000_000 }],
      bostadsfragorNollstalls: true,
    });
    const b = await h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } });
    expect(b.upplatelseform, "ingenting sparas före bekräftelsen").toBe("fastighet");
  });

  it("och nollställningen sägs också när inget tal ändras", async () => {
    seeda({ forsaljningsdatum: null }, [["Plank", "nybyggnad", 1_000_000, "2024-05-01"]]);
    const svar = await sparaBostaden({}, bostaden("bostadsratt"));
    expect(svar.underlag).toMatchObject({ summor: [], bostadsfragorNollstalls: true });
  });

  it("ett lagrat ja nollställs inte – då sägs ingenting om frågorna", async () => {
    seeda({ forsaljningsdatum: null, nybyggd_vid_forvarv: true }, [["Plank", "nybyggnad", 1_000_000, "2024-05-01"]]);
    expect(await sparaBostaden({}, bostaden("bostadsratt"))).toEqual({});
  });
});

describe("första ägaren ändras", () => {
  // En reparation och en grundförbättring samma år: utan reparationen
  // faller året under tröskeln, och sida 1 sjunker fast svaret bara rör
  // reparationer (mätt 2026-11-24).
  const FALLET: Kvitto[] = [
    ["Målning", "utbytt", 1_000_000, "2025-05-01"],
    ["Altan", "nybyggnad", 300_000, "2025-06-01"],
  ];

  it("i inställningarna, nej → ja: båda sidorna ändras, och året faller under tröskeln", async () => {
    seeda({}, FALLET);
    const fore = await exportvyn();
    const svar = await sparaForvarvet({}, forvarvet({ forsta_agare: "ja" }));
    expect(svar.underlag).toMatchObject({
      summor: [
        { sida: 1, fore: fore.sida1, efter: 0 },
        { sida: 2, fore: fore.sida2, efter: 0 },
      ],
      kvittonUtanforInnehavet: 0,
      arUnderTroskeln: { antal: 1 },
    });
  });

  it("på Frågor om bostaden: samma besked, och ingenting sparas före bekräftelsen", async () => {
    seeda({}, FALLET);
    const svar = await sparaFragorOmBostaden({}, fd({ forsta_agare: "ja", nasta: "export" }));
    expect(svar.underlag?.summor).toHaveLength(2);
    const b = await h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } });
    expect(b.nybyggd_vid_forvarv).toBe(false);
    await expect(sparaFragorOmBostaden({}, bekraftad(fd({ forsta_agare: "ja", nasta: "export" }), svar.underlag!))).rejects.toThrow(
      "NEXT_REDIRECT /export",
    );
  });

  it("ett första svar på en obesvarad fråga ger inget besked: underlaget väntade och har inget tal att jämföra", async () => {
    seeda({ nybyggd_vid_forvarv: null }, FALLET);
    await expect(sparaFragorOmBostaden({}, fd({ forsta_agare: "nej", nasta: "export" }))).rejects.toThrow("NEXT_REDIRECT /export");
  });
});

// Lydelsen ur design.md, citatet under "Beskedet när ett värde ändrar vilka
// kvitton som räknas" – läst inne i provet. Talen i citatet är tröskelfallets,
// så beskedet för just det fallet ska ge citatets rader ordagrant.
describe("rutan säger det design.md säger", () => {
  function citatet(): string[] {
    const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
    const start = design.indexOf("#### Beskedet när ett värde ändrar vilka kvitton som räknas");
    if (start < 0) throw new Error('design.md saknar "Beskedet när ett värde ändrar vilka kvitton som räknas"');
    const block = design.slice(start).match(/((?:^>.*\n)+)/m);
    if (!block) throw new Error("design.md saknar citatet under avsnittet");
    return block[1]
      .split("\n")
      .map((r) => r.replace(/^> ?/, "").replace(/\*\*/g, "").trim())
      .filter(Boolean);
  }

  it("rubrik, talet, orsakerna och knapparna, för tröskelfallet", async () => {
    const [rubrik, summa, orsaker, knappar] = citatet();
    seeda({}, TRÖSKELFALLET);
    const svar = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-08-01" }));
    const d = document.createElement("div");
    d.innerHTML = renderToStaticMarkup(createElement(UnderlagsfragaRuta, { besked: svar.underlag!, onSpara: () => {}, onAvbryt: () => {} }));
    expect(d.querySelector("h2")?.textContent).toBe(rubrik);
    expect(kr(d.querySelector('[data-underlagsbesked="summa"]')?.textContent ?? "")).toBe(summa);
    expect(kr(d.querySelector('[data-underlagsbesked="orsaker"]')?.textContent ?? "")).toBe(orsaker);
    const [tung, dampad] = knappar.split("·").map((k) => k.replace(/[[\]]/g, "").trim());
    const knapparna = [...d.querySelectorAll("button")].map((b) => b.textContent);
    expect(knapparna, "Spara ändå är den tunga knappen, först").toEqual([tung, dampad]);
  });

  it("talet efter står i fetstil, som i citatet", async () => {
    seeda({}, TRÖSKELFALLET);
    const svar = await sparaForvarvet({}, forvarvet({ tilltradesdatum: "2019-08-01" }));
    const d = document.createElement("div");
    d.innerHTML = renderToStaticMarkup(createElement(UnderlagsfragaRuta, { besked: svar.underlag!, onSpara: () => {}, onAvbryt: () => {} }));
    expect(kr(d.querySelector('[data-underlagsbesked="summa"] strong')?.textContent ?? "")).toBe("10 000 kr");
  });
});
