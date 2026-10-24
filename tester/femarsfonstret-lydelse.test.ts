// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Exportvyn renderas pa riktigt, mot en falsk databas – samma uppstallning
// som tester/hog-utan-namn.test.ts.
const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return { db: skapaFalskDatabas(), inloggad: null as { id: string; email: string } | null };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
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
  bilagelager: () => ({
    createSignedUrl: vi.fn(),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    remove: vi.fn(),
    list: vi.fn(),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import ExportSida from "@/app/export/page";
import { Landningssida } from "@/app/landningssida";
import { KategoriInfo } from "@/app/projekt/kategori-info";
import { foreForsaljningForklaring, reparationsfonsterForklaring } from "@/doman/regeltext";

// Femarsfonstret ar forsaljningsaret plus de fem narmast foregaende
// kalenderaren (CLAUDE.md, Bortfall) – inte "inom fem ar fore forsaljningen",
// som later som en rullande period bakat fran forsaljningsdagen. Den formen
// stod 2026-10-23 pa landningssidan, i projektlistans informationsknapp och i
// exportens skal, och den som laser den planerar fel.
//
// Den ratta lydelsen lases ur docs/design.md. Den forbjudna formen letas efter
// i det som renderas OCH i kallkoden, sa att en ny skarm med samma fel fangas
// aven om ingen har skrivit ett test for just den skarmen.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DESIGN = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
const normalisera = (t: string) => t.replace(/\s+/g, " ").trim();

// Det regelparametern ger i dag. Texterna tar talet som argument.
const FONSTER_AR = 5;

/**
 * Former som later som en rullande period bakat fran forsaljningsdagen:
 * "inom fem år före försäljningen", "mer än sex år före försäljningen",
 * "räknas bakåt från försäljningsdatumet".
 *
 * Och den forkortade rattelsen fran 2026-10-23, "så det går inte att räkna ut
 * ännu": ratt om fonstret, men den sager varken vad som inte gar att berakna
 * eller nar det gar. En rattelse av ett ord far inte kosta en mening.
 */
const ROLLANDE = [
  /(inom|mer än)\s+\S+\s+år\s+före\s+försäljningen/i,
  /bakåt\s+från\s+försäljnings(datumet|dagen|dag)\b/i,
  /så\s+det\s+går\s+inte\s+att\s+räkna\s+ut\s+ännu/i,
];
const arRullande = (t: string) => ROLLANDE.some((r) => r.test(t));

function infoknappenEnligtDesign(): string[] {
  const rad = DESIGN.split("\n").find((r) =>
    r.startsWith("**En informationsknapp vid listans rubrik"),
  );
  expect(rad, "informationsknappens stycke i design.md").toBeTruthy();
  const utanRubrik = rad!.replace(/^\*\*[^*]+\*\*\s*/, "");
  return utanRubrik.split(/ (?=Reparation: )/).map(normalisera);
}

/** Tabellraden under "En rad som ger 0 kr måste säga varför", andra cellen. */
function exportskaletEnligtDesign(): string {
  const rad = DESIGN.split("\n").find((r) => r.startsWith("| Reparationen ligger utanför femårsfönstret |"));
  expect(rad, "exportskalets tabellrad i design.md").toBeTruthy();
  return rad!.split("|")[2].trim();
}

/** Rutans hela lydelse pa exportvyn fore forsaljningen, ur punkten om sida 2. */
function foreForsaljningEnligtDesign(): string {
  const rad = DESIGN.split("\n").find((r) => r.startsWith("- **Sida 2 med sina rader men utan avdragsgill kolumn**"));
  expect(rad, "punkten om sida 2 fore forsaljningen i design.md").toBeTruthy();
  const traff = rad!.match(/Rutans lydelse är: \*"([^"]+)"\*/);
  expect(traff, "rutans lydelse i punkten om sida 2").toBeTruthy();
  return traff![1];
}

const ANNA = "a0000000-0000-4000-8000-0000000000c1";
const OSALD = "b0000000-0000-4000-8000-0000000000c1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

beforeEach(() => {
  h.db.nollstall();
  for (const r of REGELPARAMETRAR) {
    h.db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  h.db.lagg("bostad", {
    id: OSALD, adress: "Kvarnvägen 12 B", upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"), bostadsfragor_besvarade: true,
  });
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: OSALD, agarandel: 100 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
});

function elementFor(nod: unknown, namn: string): ReactElement[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<{ children?: unknown }> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

/** Exportvyns meddelanderutor, renderade, som hel text per ruta. */
async function exportvynsRutor(): Promise<string[]> {
  const vy = await ExportSida();
  return elementFor(vy, "Meddelanderuta").map((e) =>
    normalisera(new DOMParser().parseFromString(renderToStaticMarkup(e), "text/html").body.textContent ?? ""),
  );
}

/** Informationsknappen, oppnad med ett riktigt klick, som text per stycke. */
async function infoknappensText(): Promise<string[]> {
  const behallare = document.createElement("div");
  document.body.appendChild(behallare);
  const rot = createRoot(behallare);
  await act(async () => rot.render(createElement(KategoriInfo, { fonsterAr: FONSTER_AR })));
  const knapp = behallare.querySelector("button")!;
  await act(async () => knapp.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  const stycken = [...behallare.querySelectorAll("div.bg-sand p")].map((p) => normalisera(p.textContent ?? ""));
  await act(async () => rot.unmount());
  behallare.remove();
  return stycken;
}

describe("projektlistans informationsknapp", () => {
  it("säger ordagrant det design.md säger, när den öppnats", async () => {
    const forvantat = infoknappenEnligtDesign();
    expect(forvantat).toHaveLength(2);
    expect(await infoknappensText()).toEqual(forvantat);
  });
});

describe("exportens skäl när en reparation fallit ur fönstret", () => {
  // Tabellens celler bar ingen slutpunkt, ingen av dem; skalet star som en
  // mening under sin rad och far sin. Det ar den enda skillnaden, och den ar
  // skriven har i stallet for att slukas av en jamforelse som ignorerar den.
  it("är tabellradens lydelse i design.md, plus meningens punkt", () => {
    expect(reparationsfonsterForklaring(FONSTER_AR)).toBe(`${exportskaletEnligtDesign()}.`);
  });
});

describe("exportvyn före försäljningen", () => {
  it("rutan säger design.md:s hela lydelse – vad som inte går att beräkna, och när", async () => {
    const forvantat = foreForsaljningEnligtDesign();
    expect(foreForsaljningForklaring(FONSTER_AR)).toBe(forvantat);
    expect(await exportvynsRutor()).toContain(forvantat);
  });
});

describe("ingenstans beskrivs fönstret som en period bakåt från försäljningen", () => {
  it("inte i det som renderas", async () => {
    const renderat = [
      normalisera(new DOMParser().parseFromString(renderToStaticMarkup(Landningssida()), "text/html").body.textContent ?? ""),
      ...(await infoknappensText()),
      ...[5, 6, 15].map(reparationsfonsterForklaring),
      ...(await exportvynsRutor()),
    ];
    expect(renderat.filter(arRullande)).toEqual([]);
  });

  it("inte i någon källfil – en ny skärm med samma fel fångas också", () => {
    const filer: string[] = [];
    const ga = (k: string) => {
      for (const n of readdirSync(k)) {
        const p = join(k, n);
        if (statSync(p).isDirectory()) ga(p);
        else if (/\.(tsx?|md)$/.test(n)) filer.push(p);
      }
    };
    ga(join(process.cwd(), "src"));
    expect(filer.length).toBeGreaterThan(50);

    const traffar = filer.filter((f) => {
      // Ett uttryck i JSX ({talSomOrd(fonsterAr)}) ar ett ord i den renderade
      // texten – raknas som ett.
      const text = normalisera(readFileSync(f, "utf-8").replace(/\{[^{}\n]*\}/g, "X"));
      return arRullande(text);
    });
    expect(traffar).toEqual([]);
  });
});
