// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Underlaget medan bostadsfrågorna är obesvarade (docs/design.md, Exportvyn,
// "Och sidan väntar på bostadsfrågorna också före försäljningen"; produktspec
// 4.1). Beräkningen kräver svaret och kastar utan det – det står kvar. Sidan
// väntar i stället för att misslyckas: raderna visas, summorna hålls tillbaka,
// och Återstår namnger det som fattas och leder till Frågor om bostaden.
//
// Ingenting gissas. Ett tal visas bara om det är detsamma vilket svaret än
// blir (src/doman/vantande-underlag.ts) – och förutsättningen prövas: med ett
// fall där svaret faktiskt ändrar summorna, annars bevisar likheten ingenting.

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
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import ExportSida from "@/app/export/page";
import { sparaFragorOmBostaden } from "@/app/bostaden/fragor/actions";
import FragorSida from "@/app/bostaden/fragor/page";
import { byggK6aExport, VantarPaBostadsfragor, type K6aIndata } from "@/doman/export-k6a";
import { sammaRader, vantandeUnderlag } from "@/doman/vantande-underlag";
import { VANTAR_PA_BOSTADSFRAGOR_TEXT } from "@/doman/export-k6a";
import { formateraKronor } from "@/lib/format";
import {
  tillDomanBostad,
  tillDomanKostnad,
  tillDomanProjekt,
  tillDomanRegelparameter,
} from "@/lib/doman-fran-db";

const ANNA = "a0000000-0000-4000-8000-000000000091";
const X = "b0000000-0000-4000-8000-000000000091";
const ALTAN = "c0000000-0000-4000-8000-000000000091";
const FONSTER = "c0000000-0000-4000-8000-000000000092";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const design = () => readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

/** Raden i Återstår, ur design.md under Exportvyn. */
function aterstarRaden(): { rubrik: string; rad: string; lank: string } {
  const m = design().match(/^> \*\*(Vi vet inte om bostaden var nybyggd[^*]+)\*\*\n> ([^*\n]+?) \*\*([^*]+)\*\*$/m);
  if (!m) throw new Error("design.md saknar raden om bostadsfrågorna under Exportvyn");
  return { rubrik: m[1], rad: m[2], lank: m[3] };
}

/**
 * En såld bostad med en altan (sida 1) och ett fönsterbyte (sida 2) samma år.
 * Altanen ensam ligger under tröskeln; med fönstren passerar året. Svaret om
 * nybyggd avgör alltså om altanen räknas – precis det som inte får gissas.
 */
function seeda({ nybyggd = null as boolean | null, sald = true } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: nybyggd, ...(sald ? { forsaljningsdatum: datum("2026-09-15") } : {}),
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: ALTAN, bostad_id: X, namn: "Ny altan", ar: 2025, atgardstyp: "nybyggnad" });
  db.lagg("projekt", {
    id: FONSTER, bostad_id: X, namn: "Nya fönster", ar: 2025, atgardstyp: "utbytt",
    battre_kvalitet: false, skick_forvarv: 1, skick_forsaljning: 4,
  });
  for (const [projekt, belopp, dag] of [[ALTAN, 300_000, "2025-05-02"], [FONSTER, 900_000, "2025-06-10"]] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Byggmax", totalbelopp: belopp,
      dokumentdatum: datum(dag), betaldatum: datum(dag),
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projekt, andel: 1 });
  }
  // Ett kvitto utan projekt.
  const fri = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Bauhaus", anteckning: "Färg till hallen", totalbelopp: 45_000,
    dokumentdatum: datum("2025-08-01"), betaldatum: datum("2025-08-01"),
  });
  db.lagg("kostnadsrad", { kostnad_id: fri.id, artikel: "Färg", belopp: 45_000 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function indata(): Promise<K6aIndata> {
  const k = h.db.klient;
  const bostad = await k.bostad.findUniqueOrThrow({ where: { id: X } });
  return {
    bostad: tillDomanBostad(bostad as never),
    medlemskap: { agarandel: 100 },
    projekt: ((await k.projekt.findMany({ where: { bostad_id: X } })) as never[]).map(tillDomanProjekt),
    kostnader: ((await k.kostnad.findMany({
      where: { bostad_id: X }, include: { rader: { include: { fordelningar: true } } },
    })) as never[]).map(tillDomanKostnad),
    kostnader_med_bilaga: [],
    regelparametrar: ((await k.regelparameter.findMany()) as never[]).map(tillDomanRegelparameter),
  };
}

async function sidan(): Promise<HTMLDivElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup(await ExportSida());
  return div;
}

beforeEach(() => seeda());

describe("ingenting gissas", () => {
  it("förutsättningen: svaret ändrar summorna i det här fallet", async () => {
    const i = await indata();
    const med = (nybyggd: boolean) => byggK6aExport({ ...i, bostad: { ...i.bostad, nybyggd_vid_forvarv: nybyggd } });
    expect(() => byggK6aExport(i)).toThrow(VantarPaBostadsfragor);
    expect(med(false).ruta4_brutto, "inte nybyggd: året passerar tröskeln").toBe(300_000);
    expect(med(true).ruta4_brutto, "nybyggd: altanen ensam under tröskeln").toBe(0);
  });

  // Skyddsnätet: skulle en rad skilja sig mellan svaren får den inget belopp.
  // Beräkningen kan inte framkalla det, så det prövas med rader för hand.
  it("en rad vars belopp beror av svaret får inget belopp", () => {
    const a = [{ atgard: "Nya fönster", ar: 2025, kostnad_brutto: 900_000 }];
    expect(sammaRader(a, [{ ...a[0], kostnad_brutto: 0 }])).toEqual([{ atgard: "Nya fönster", ar: 2025, belopp: null }]);
    expect(sammaRader(a, [])).toEqual([{ atgard: "Nya fönster", ar: 2025, belopp: null }]);
    expect(sammaRader(a, a)).toEqual([{ atgard: "Nya fönster", ar: 2025, belopp: 900_000 }]);
  });

  it("raderna och vad de kostade är desamma för båda svaren, och visas", async () => {
    const v = vantandeUnderlag(await indata());
    expect(v.sida1).toEqual([{ atgard: "Ny altan", ar: 2025, belopp: 300_000 }]);
    expect(v.sida2).toEqual([{ atgard: "Nya fönster", ar: 2025, belopp: 900_000 }]);
  });
});

describe("underlaget väntar i stället för att misslyckas", () => {
  // Felets egen text (PDF:en, felrapporter) säger samma sak som raden i
  // Återstår – aldrig att något misslyckades.
  it("väntetexten är designens rad, inte ett misslyckande", () => {
    const { rubrik, rad } = aterstarRaden();
    expect(VANTAR_PA_BOSTADSFRAGOR_TEXT).toBe(`${rubrik}. ${rad}`);
  });

  it("säger aldrig att sammanställningen inte går att göra", async () => {
    const s = await sidan();
    expect(s.textContent).not.toMatch(/går inte att göra/);
    expect(s.textContent).not.toMatch(/kunde inte beräknas/);
  });

  it("visar raderna med sina belopp, och ingen avdragsgill kolumn", async () => {
    const s = await sidan();
    const rader = [...s.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent));
    expect(rader).toEqual([
      ["Ny altan", "2025", formateraKronor(300_000)],
      ["Nya fönster", "2025", formateraKronor(900_000)],
    ]);
    expect([...s.querySelectorAll("th")].map((t) => t.textContent)).not.toContain("Avdragsgill del");
  });

  it("håller tillbaka summorna – inget tal och ingen Förs till", async () => {
    const s = await sidan();
    expect(s.textContent).not.toMatch(/Förs till/);
    const summor = [...s.querySelectorAll("section")].filter((e) => e.textContent?.startsWith("Summa sida"));
    expect(summor.map((e) => e.textContent)).toEqual([
      "Summa sida 1 – grundförbättringar–",
      "Summa sida 2 – avdragsgill del efter förslitning–",
    ]);
    // Dämpade som varje ofullständig summa.
    for (const e of summor) expect(e.querySelector(".font-rubrik")!.className).toContain("text-text-sekundar");
  });

  it("Återstår börjar med designens rad och leder till Frågor om bostaden", async () => {
    const { rubrik, rad, lank } = aterstarRaden();
    const s = await sidan();
    const forsta = s.querySelector("ul li")!;
    const delar = [...forsta.children].map((e) => e.textContent);
    expect(delar).toEqual([rubrik, `${rad} ${lank}`]);
    const a = [...forsta.querySelectorAll("a")];
    expect(a.map((x) => [x.textContent, x.getAttribute("href")])).toEqual([[lank, "/bostaden/fragor?fran=export"]]);
  });

  it("och kvittot utan projekt står kvar, med vägen till Skapa projekt", async () => {
    const s = await sidan();
    const texter = [...s.querySelectorAll("ul li")].map((li) => li.textContent);
    expect(texter.some((t) => t?.startsWith("Färg till hallen"))).toBe(true);
    const knapp = [...s.querySelectorAll("a")].find((a) => a.textContent === "Berätta vad du gjort");
    expect(knapp?.getAttribute("href")).toBe("/projekt/nytt");
  });

  it("före försäljningen likadant, utan sida 2:s summa", async () => {
    seeda({ sald: false });
    const s = await sidan();
    const summor = [...s.querySelectorAll("section")].filter((e) => e.textContent?.startsWith("Summa sida"));
    expect(summor.map((e) => e.textContent)).toEqual(["Summa sida 1 – grundförbättringar–"]);
    expect(s.querySelector("ul li")!.textContent).toContain(aterstarRaden().rubrik);
  });

  it("med besvarade frågor ser underlaget ut som vanligt", async () => {
    seeda({ nybyggd: false });
    const s = await sidan();
    expect(s.textContent).not.toContain(aterstarRaden().rubrik);
    expect(s.textContent).toMatch(/Förs till/);
  });
});

describe("Frågor om bostaden", () => {
  function rubrikenIDesign(): string {
    const m = design().match(/Sidans rubrik är \*\*"([^"]+)"\*\*/);
    if (!m) throw new Error("design.md saknar sidans rubrik under Exportvyn");
    return m[1];
  }

  it("har designens rubrik, och heter inte försäljning", async () => {
    const div = document.createElement("div");
    div.innerHTML = renderToStaticMarkup(await FragorSida({ searchParams: Promise.resolve({ fran: "export" }) }));
    expect([...div.querySelectorAll("h1")].map((x) => x.textContent)).toEqual([rubrikenIDesign()]);
    expect(div.textContent).not.toMatch(/försäljning/i);
  });

  it("från underlaget leder svaret tillbaka dit, även för en såld bostad", async () => {
    const f = new FormData();
    f.set("forsta_agare", "nej");
    f.set("nasta", "export");
    await expect(sparaFragorOmBostaden({}, f)).rejects.toThrow("NEXT_REDIRECT /export");
    expect(h.db.tabell("bostad")[0].nybyggd_vid_forvarv).toBe(false);
  });

  it("ett okänt nasta-värde styr ingenting – den sålda bostaden går vidare i flödet", async () => {
    const f = new FormData();
    f.set("forsta_agare", "nej");
    f.set("nasta", "https://exempel.se");
    // Fönstren har sitt skick; nästa steg som gäller är andelen.
    await expect(sparaFragorOmBostaden({}, f)).rejects.toThrow("NEXT_REDIRECT /forsaljning/andel");
  });
});
