// @vitest-environment jsdom
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// "Det enda datumfältet i ett nytt kvitto är betaldatumet" (docs/design.md).
// Uppmatt 2026-11-18: en faktura daterad 2025-12-28 och betald 2026-01-08
// hamnade pa 2025 i kvittolistan, i arssumman och i troskelprovningen. Varje
// berakning var ratt – den fick fel tal av ett falt som hette "Datum", som
// avlasningen fyllde med fakturans datum och som skrevs till bada kolumnerna.
//
// Provet gar hela vagen: modellens SVAR (Anthropic-klienten ar det enda
// falska), den riktiga tolkningen, avlasningen, sidan, formularet och
// sparandet – och sedan kvittolistan, arssumman och kvittots egen sida. Tre
// svar fran modellen, sa att det syns vad som bar aret:
//   * betaldagen last           -> 2026
//   * betaldagen missad         -> 2025 (dokumentets datum, inte ett tomt falt)
//   * ett kassakvitto, en dag   -> samma dag i bada kolumnerna, som forut

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
    modellsvar: "",
    modellanrop: 0,
  };
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async () => {
        h.modellanrop++;
        return { content: [{ type: "text", text: h.modellsvar }], stop_reason: "end_turn" };
      },
    };
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => { throw new Error(`redirect ${u}`); },
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  usePathname: () => "/kostnad/nytt",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/feltrapportering", () => ({ rapporteraFel: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({ auth: { getUser: async () => ({ data: { user: h.inloggad } }) } }),
}));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: async ({ bilagaId }: { bilagaId: string }) =>
    (await import("@/lib/dokumentavlasning/lagring")).analyseraKostnadsbilaga({ bostadId: X, bilagaId }),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
  begarBilagauppladdning: vi.fn(async () => ({})),
  bekraftaBilagauppladdning: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: vi.fn() }));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({
    // En riktig PNG, 1 × 1 bildpunkt: metadatan rensas fore avlasningen
    // (src/lib/dokumentavlasning/metadata.ts), och en fil som inte gar att
    // lasa skickas inte alls. Till 2026-11-20 rackte de fyra forsta bytena.
    download: async () => ({
      data: {
        arrayBuffer: async () =>
          Uint8Array.from(
            atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
            (c) => c.charCodeAt(0),
          ).buffer,
      },
      error: null,
    }),
    createSignedUrl: async () => ({ data: { signedUrl: "about:blank" }, error: null }),
    createSignedUrls: async () => ({ data: [], error: null }),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import KostnadSida from "@/app/kostnad/[id]/page";
import { sparaUtkastfalten } from "@/app/kostnad/nytt/actions";
import { BETALDATUM_HJALPTEXT } from "@/app/kostnad/nytt/form";
import NyKostnadSida from "@/app/kostnad/nytt/page";
import KvittolistaSida from "@/app/kostnad/page";
import { arssummaForBostad, troskelUppnadd } from "@/doman/berakningar";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-000000000094";
const X = "b0000000-0000-4000-8000-000000000094";
const P = "c0000000-0000-4000-8000-000000000094";
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : x);
const TROSKEL = REGELPARAMETRAR.find((r) => r.nyckel === "troskelbelopp")!.varde;

const NYCKEL_FORE = process.env.ANTHROPIC_API_KEY;
beforeAll(() => { process.env.ANTHROPIC_API_KEY = "test"; });
afterAll(() => {
  if (NYCKEL_FORE === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = NYCKEL_FORE;
});

/** Varje synligt datumfalt (det med en arsruta): etiketten, utan
 *  obligatoriskt-markeringen, och texten under faltet. */
function datumfaltMedNamn(beh: HTMLElement): { etikett: string; under: string }[] {
  return [...beh.querySelectorAll("label")]
    .filter((l) => l.querySelector('input[aria-label$=", år"]') && l.closest("[hidden]") === null)
    .map((l) => {
      const spans = [...l.children].filter((c) => c.tagName === "SPAN");
      const etikett = (spans[0]?.textContent ?? "").replace(/\*$/, "").trim();
      const under = spans.length > 1 ? (spans[spans.length - 1].textContent ?? "").trim() : "";
      return { etikett, under };
    });
}

/** Modellens svar pa fakturan: 8 500 kr fore ROT, 1 800 kr ROT, 6 700 kr att betala. */
function svar(datum: { dokumentdatum: string; betaldatum: string | null }) {
  return JSON.stringify({
    ...datum, valuta: "SEK", leverantor: "Snickeri Nord AB", att_betala: 6700, rot_utnyttjat: 1800,
    netto: 6800, moms: 1700, summa_fore_rot: 8500,
  });
}

/** Seedar bostaden – med ett kvitto pa 3 000 kr betalt 2026-05-10 – och
 *  utkastet som skapas nar fakturan valts. Lagger in fakturan genom sidan och
 *  formularet, kopplar den till projektet som genomgangen gor, och lamnar
 *  tillbaka det som syns. */
async function laggIn(modellsvar: string) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: d(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: d("2019-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Trappan", ar: 2026, atgardstyp: "nybyggnad" });
  const annat = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Bauhaus", totalbelopp: 300_000,
    dokumentdatum: d("2026-05-10"), betaldatum: d("2026-05-10"), skapad_av: ANNA,
  });
  const ar = db.lagg("kostnadsrad", { kostnad_id: annat.id, artikel: "Virke", belopp: 300_000 });
  db.lagg("radfordelning", { kostnadsrad_id: ar.id, projekt_id: P, andel: 1 });
  const u = db.lagg("kostnad", { bostad_id: X, skapad_av: ANNA });
  db.lagg("bilaga", {
    kostnad_id: u.id, lagringsnyckel: `${X}/${u.id}/a.png`, filnamn: "faktura.png", mimetyp: "image/png",
    storlek: 100_000, uppladdning_bekraftad: true, dokument_analyserad: false,
  });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
  h.modellsvar = modellsvar;
  h.modellanrop = 0;

  const sida = (await NyKostnadSida({ searchParams: Promise.resolve({ utkast: u.id as string }) })) as ReactElement<{
    children: ReactElement;
  }>;
  const beh = document.createElement("div");
  document.body.appendChild(beh);
  const rot = createRoot(beh);
  await act(async () => rot.render(sida.props.children));
  for (let i = 0; i < 30; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  expect(h.modellanrop, "forutsattningen: avlasningen kordes").toBe(1);
  const datumfaltet = beh.querySelector<HTMLInputElement>('input[name="betaldatum"]')!.value;
  const etiketter = [...beh.querySelectorAll("label")].map((l) => (l.textContent ?? "").replace(/\s/g, " "));
  const formularetsFalt = datumfaltMedNamn(beh);
  await act(async () => { beh.querySelector("form")!.requestSubmit(); });
  for (let i = 0; i < 30; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => rot.unmount());
  beh.remove();

  const rad = db.tabell("kostnad").find((k) => k.id === u.id)!;
  expect(rad.totalbelopp, "forutsattningen: fakturan sparades").toBe(850_000);

  const lista = document.createElement("div");
  lista.innerHTML = renderToStaticMarkup(await KvittolistaSida());
  const rubriker = [...lista.querySelectorAll("summary")].map((r) => (r.textContent ?? "").replace(/\s/g, " "));

  for (const kr of db.tabell("kostnadsrad").filter((r) => r.kostnad_id === u.id)) {
    db.lagg("radfordelning", { kostnadsrad_id: kr.id, projekt_id: P, andel: 1 });
  }
  const data = await hamtaBostadsdata(X);
  const arssumma = (n: number) => {
    const s = arssummaForBostad({ kostnader: data.kostnader, projekt: data.projekt }, n);
    return { summa: s, troskel: troskelUppnadd(s, TROSKEL) };
  };

  const kvittot = renderToStaticMarkup(
    (await KostnadSida({ params: Promise.resolve({ id: u.id as string }) })) as ReactElement,
  ).replace(/\s/g, " ");

  // Andringslaget: kvittots sida i webblasarens trad, och ett tryck pa
  // "Ändra" som hon gor det.
  const kort = document.createElement("div");
  document.body.appendChild(kort);
  const kortrot = createRoot(kort);
  await act(async () =>
    kortrot.render((await KostnadSida({ params: Promise.resolve({ id: u.id as string }) })) as ReactElement),
  );
  const andra = [...kort.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Ändra");
  expect(andra, "knappen Ändra pa kvittots sida hittades inte").toBeDefined();
  await act(async () => { andra!.click(); });
  const andringslagetsFalt = datumfaltMedNamn(kort);
  await act(async () => kortrot.unmount());
  kort.remove();

  return {
    datumfaltet, etiketter, rubriker, kvittot, formularetsFalt, andringslagetsFalt,
    betaldatum: iso(rad.betaldatum), dokumentdatum: iso(rad.dokumentdatum),
    ar2025: arssumma(2025), ar2026: arssumma(2026),
  };
}

describe("faltet heter Betaldatum och sager vad det avgor", () => {
  it("hjalptexten ar designfilens, ordagrant", async () => {
    const design = await readFile(path.resolve(import.meta.dirname, "../docs/design.md"), "utf8");
    const traff = design.match(/\*\*Fältet heter \*Betaldatum\* och säger vad det avgör:\*\* \*"([^"]+)"\*/);
    expect(traff, "lydelsen hittades inte i docs/design.md").not.toBeNull();
    expect(BETALDATUM_HJALPTEXT).toBe(traff![1]);
  });
});

describe("samma dag heter samma sak pa alla tre skarmar", () => {
  // docs/design.md, "Fältet heter Kvittots datum överallt": formularet,
  // lasläget och andringsläget. Namnet och hjalptexten lases ur designfilen
  // inne i provet.
  it("formularet och andringslaget: Kvittots datum med hjalptexten, lasläget: Kvittots datum", async () => {
    const design = await readFile(path.resolve(import.meta.dirname, "../docs/design.md"), "utf8");
    const namn = design.match(/\*\*Fältet heter \*([^*]+)\* överallt\.\*\*/);
    const hjalp = design.match(/\*\*Fältet heter \*[^*]+\* överallt\.\*\*[^\n]*?Hjälptexten är \*"([^"]+)"\*/);
    expect(namn, "namnet hittades inte i docs/design.md").not.toBeNull();
    expect(hjalp, "hjalptexten hittades inte i docs/design.md").not.toBeNull();
    const kvittodatum = { etikett: namn![1], under: hjalp![1] };

    const r = await laggIn(svar({ dokumentdatum: "2025-12-28", betaldatum: "2026-01-08" }));
    expect(r.formularetsFalt, "nytt kvitto").toEqual([
      { etikett: "Betaldatum", under: BETALDATUM_HJALPTEXT },
      kvittodatum,
    ]);
    expect(r.andringslagetsFalt.find((f) => f.etikett !== "Betaldatum"), "kvittots andringslage").toEqual(kvittodatum);
    expect(r.kvittot, "kvittots lasläge").toContain(`${namn![1]} 2025-12-28`);
  });
});

describe("fakturan daterad 2025-12-28, betald 2026-01-08", () => {
  it("betaldagen last: 2026 i listan, i arssumman och i troskeln", async () => {
    const r = await laggIn(svar({ dokumentdatum: "2025-12-28", betaldatum: "2026-01-08" }));
    expect(r.etiketter.some((e) => e.startsWith("Betaldatum")), "etiketten Betaldatum").toBe(true);
    expect(r.etiketter.some((e) => e.includes(BETALDATUM_HJALPTEXT)), "hjalptexten under faltet").toBe(true);
    expect(r.etiketter.some((e) => /^Datum\b/.test(e)), "ett falt som heter bara Datum").toBe(false);
    expect(r.datumfaltet).toBe("2026-01-08");
    expect({ betaldatum: r.betaldatum, dokumentdatum: r.dokumentdatum }).toEqual({
      betaldatum: "2026-01-08", dokumentdatum: "2025-12-28",
    });
    // Bauhaus 3 000 kr och fakturan 8 500 − 1 800 = 6 700 kr, bada 2026.
    expect(r.rubriker).toEqual(["2026 · 2 kvitton9 700 kr"]);
    expect(r.ar2026).toEqual({ summa: 300_000 + 670_000, troskel: true });
    expect(r.ar2025).toEqual({ summa: 0, troskel: false });
    // Kvittots sida: datumet som avgor aret, och fakturans datum dampat under.
    expect(r.kvittot).toContain("Betaldatum");
    expect(r.kvittot).toContain("2026-01-08");
    expect(r.kvittot).toContain("Kvittots datum 2025-12-28");
  });

  it("betaldagen missad: faltet far fakturans datum, inte ett tomt falt – och aret blir 2025", async () => {
    const r = await laggIn(svar({ dokumentdatum: "2025-12-28", betaldatum: null }));
    expect(r.datumfaltet).toBe("2025-12-28");
    expect({ betaldatum: r.betaldatum, dokumentdatum: r.dokumentdatum }).toEqual({
      betaldatum: "2025-12-28", dokumentdatum: "2025-12-28",
    });
    expect(r.rubriker).toEqual(["2026 · 1 kvitto3 000 kr", "2025 · 1 kvitto6 700 kr"]);
    expect(r.ar2026).toEqual({ summa: 300_000, troskel: false });
    expect(r.ar2025).toEqual({ summa: 670_000, troskel: true });
    expect(r.kvittot).not.toContain("Kvittots datum");
  });
});

describe("ett kassakvitto med en enda dag andras inte", () => {
  it("samma dag i bada kolumnerna, och ingen extra rad pa kvittots sida", async () => {
    const r = await laggIn(svar({ dokumentdatum: "2026-03-02", betaldatum: null }));
    expect(r.datumfaltet).toBe("2026-03-02");
    expect({ betaldatum: r.betaldatum, dokumentdatum: r.dokumentdatum }).toEqual({
      betaldatum: "2026-03-02", dokumentdatum: "2026-03-02",
    });
    expect(r.rubriker).toEqual(["2026 · 2 kvitton9 700 kr"]);
    expect(r.kvittot).toContain("2026-03-02");
    expect(r.kvittot).not.toContain("Kvittots datum");
  });
});

describe("utkastet minns bada datumen", () => {
  it("sparat lopande och oppnat igen: betaldatumet i faltet, fakturans datum kvar bredvid", async () => {
    await laggIn(svar({ dokumentdatum: "2025-12-28", betaldatum: "2026-01-08" }));
    const u = h.db.lagg("kostnad", { bostad_id: X, skapad_av: ANNA });
    const r = await sparaUtkastfalten(u.id as string, {
      belopp: "8 500,00", datum: "2026-01-08", dokumentdatum: "2025-12-28",
      leverantor: "Snickeri Nord AB", rot: "1 800,00", anteckning: "",
    });
    expect(r).toEqual({ ok: true });
    const rad = h.db.tabell("kostnad").find((k) => k.id === u.id)!;
    expect({ betaldatum: iso(rad.betaldatum), dokumentdatum: iso(rad.dokumentdatum), totalbelopp: rad.totalbelopp }).toEqual({
      betaldatum: "2026-01-08", dokumentdatum: "2025-12-28", totalbelopp: null,
    });

    const sida = (await NyKostnadSida({ searchParams: Promise.resolve({ utkast: u.id as string }) })) as ReactElement<{
      children: ReactElement;
    }>;
    const beh = document.createElement("div");
    document.body.appendChild(beh);
    const rot = createRoot(beh);
    await act(async () => rot.render(sida.props.children));
    for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const dolt = (n: string) => beh.querySelector<HTMLInputElement>(`input[type=hidden][name="${n}"]`)!.value;
    const igen = { betaldatum: dolt("betaldatum"), dokumentdatum: dolt("dokumentdatum") };
    await act(async () => rot.unmount());
    beh.remove();
    expect(igen).toEqual({ betaldatum: "2026-01-08", dokumentdatum: "2025-12-28" });
  });
});
