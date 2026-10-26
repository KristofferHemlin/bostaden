import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// CLAUDE.md, Berakningen: "ROT fordelas proportionellt mellan atgarder pa samma
// kvitto." Begransningen att ett kvitto med ROT eller forsakringsersattning
// bara fick kopplas till ett projekt stroks 2026-10-18 (produktspec, "Kostnad")
// – men koden vagrade fortfarande, och testfallet i CLAUDE.md:s lista gick att
// rakna men inte att mata in. Den vanligaste fakturan med ROT ar en
// entreprenorsfaktura som tacker flera atgarder.
//
// Har provas vagen IN: serveratgarderna som formularen skickar till, mot en
// databas i minnet som tolkar `where` pa riktigt, och sedan summan som las
// tillbaka ur databasen precis som projektsidan gor.

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
  bilagelager: () => ({ createSignedUrl: vi.fn(), createSignedUrls: vi.fn(), remove: vi.fn(), list: vi.fn() }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import { delaUppKostnad, redigeraKostnad } from "@/app/kostnad/[id]/actions";
import { projektSumma, rotForBelopp } from "@/doman/berakningar";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";

const ANNA = "a0000000-0000-4000-8000-0000000000d1";
const BOSTAD = "b0000000-0000-4000-8000-0000000000d1";
const KOK = "c0000000-0000-4000-8000-0000000000d1";
const BADRUM = "c0000000-0000-4000-8000-0000000000d2";
const FAKTURA = "d0000000-0000-4000-8000-0000000000d1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** 10 000 kr fran en firma, en enda rad, med eller utan ROT. CLAUDE.md:s testfall. */
function seeda(rot: number | null) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: BOSTAD, adress: "Kvarnvägen 12 B", upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"), bostadsfragor_besvarade: true,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: BOSTAD, agarandel: 100 });
  db.lagg("projekt", { id: KOK, bostad_id: BOSTAD, namn: "Köket", ar: 2026, atgardstyp: "nybyggnad" });
  db.lagg("projekt", { id: BADRUM, bostad_id: BOSTAD, namn: "Badrummet", ar: 2026, atgardstyp: "nybyggnad" });
  db.lagg("kostnad", {
    id: FAKTURA, bostad_id: BOSTAD, leverantor: "Byggfirman AB", totalbelopp: 1_000_000,
    rot_utnyttjat: rot, dokumentdatum: datum("2026-05-02"), betaldatum: datum("2026-05-02"), skapad_av: ANNA,
  });
  const rad = h.db.lagg("kostnadsrad", { kostnad_id: FAKTURA, artikel: "Arbete", belopp: 1_000_000 });
  db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: KOK, andel: 1 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Formularet pa /kostnad/[id]/dela: en post per rad. */
function uppdelning(rader: [artikel: string, belopp: string, mal: string, andel: string][]): FormData {
  const f = new FormData();
  f.set("kostnad_id", FAKTURA);
  for (const [artikel, belopp, mal, andel] of rader) {
    f.append("artikel", artikel);
    f.append("belopp", belopp);
    f.append("mal", mal);
    f.append("andel", andel);
  }
  return f;
}

/**
 * Skickar uppdelningsformularet. En lyckad uppdelning skickar anvandaren
 * tillbaka till kvittot – det ar beskedet att den sparades. Ett fel returneras.
 */
async function dela(f: FormData): Promise<"sparad" | { fel?: string }> {
  try {
    return await delaUppKostnad({}, f);
  } catch (e) {
    if (e instanceof h.Omdirigering && e.url === `/kostnad/${FAKTURA}`) return "sparad";
    throw e;
  }
}

/** Vad projektet far ur databasen – samma summa som projektsidan visar. */
async function bidrag(projektId: string): Promise<number> {
  const { kostnader } = await hamtaBostadsdata(BOSTAD);
  return projektSumma(kostnader, projektId);
}

beforeEach(() => vi.clearAllMocks());

describe("ett kvitto med ROT kan delas mellan två åtgärder – hela vägen genom formuläret", () => {
  it("CLAUDE.md:s testfall: 10 000 kr, 3 000 kr ROT, 60 % till en åtgärd – bidrar med 4 200 kr", async () => {
    seeda(300_000);
    // Formularet har en malkoppling per rad, sa "raden fordelad 60 % mellan
    // tva atgarder" matas in som tva rader: 6 000 kr till koket, 4 000 kr
    // till badrummet.
    const svar = await dela(uppdelning([
      ["Arbete kök", "6 000", KOK, ""],
      ["Arbete badrum", "4 000", BADRUM, ""],
    ]));
    expect(svar).toBe("sparad");
    expect(await bidrag(KOK)).toBe(420_000);
    expect(await bidrag(BADRUM)).toBe(280_000);
  });

  it("samma tal när andelsfältet används: 7 500 kr till 80 % på köket", async () => {
    seeda(300_000);
    // 7 500 kr * 80 % = 6 000 kr till koket; resten av raden ar okopplad.
    const svar = await dela(uppdelning([
      ["Arbete", "7 500", KOK, "80"],
      ["Material", "2 500", BADRUM, ""],
    ]));
    expect(svar).toBe("sparad");
    expect(await bidrag(KOK)).toBe(420_000);
    // 2 500 kr * 0,7: badrummet bar sin andel av avdraget, inte noll och inte allt.
    expect(await bidrag(BADRUM)).toBe(175_000);
  });

  it("dela upp först, fyll i ROT sedan – kvittokortet tar emot det", async () => {
    seeda(null);
    expect(await dela(uppdelning([
      ["Arbete kök", "6 000", KOK, ""],
      ["Arbete badrum", "4 000", BADRUM, ""],
    ]))).toBe("sparad");

    // Kvittokortet pa ett uppdelat kvitto: bara leverantor, datum och ROT andras.
    const f = new FormData();
    for (const [k, v] of Object.entries({
      kostnad_id: FAKTURA, leverantor: "Byggfirman AB", dokumentdatum: "2026-05-02",
      betaldatum: "2026-05-02", anteckning: "", rot_utnyttjat: "3 000",
    })) f.set(k, v);
    expect(await redigeraKostnad({}, f)).toEqual({});

    expect(await bidrag(KOK)).toBe(420_000);
    expect(await bidrag(BADRUM)).toBe(280_000);
  });
});

describe("ROT fördelas i proportion till radernas andel", () => {
  it("varje rads ROT är dess andel av bostadens del, och de går ihop till hela avdraget", async () => {
    seeda(300_000);
    await dela(uppdelning([
      ["Arbete kök", "6 000", KOK, ""],
      ["Arbete badrum", "4 000", BADRUM, ""],
    ]));
    const { kostnader } = await hamtaBostadsdata(BOSTAD);
    const k = kostnader.find((x) => x.id === FAKTURA)!;
    const [kok, badrum] = k.rader;
    expect(rotForBelopp(k, kok.belopp)).toBe(180_000);
    expect(rotForBelopp(k, badrum.belopp)).toBe(120_000);
    expect(rotForBelopp(k, kok.belopp) + rotForBelopp(k, badrum.belopp)).toBe(300_000);
  });
});

describe("gränsen håller efter uppdelningen", () => {
  // CLAUDE.md, steg 2: rot < bostadens del. En uppdelning som gor en del av
  // kvittot privat krymper bostadens del, och ROT maste fortfarande rymmas.
  it("ROT som inte ryms i den nya bostadsdelen vägras – inget sparas", async () => {
    seeda(300_000);
    const fore = h.db.tabell("kostnadsrad").length;
    const svar = await dela(uppdelning([
      ["Privat", "7 500", "privat", ""],
      ["Arbete kök", "1 500", KOK, ""],
      ["Arbete badrum", "1 000", BADRUM, ""],
    ]));
    // Bostadens del ar 2 500 kr; 3 000 kr ROT ryms inte.
    expect(svar).not.toBe("sparad");
    expect((svar as { fel?: string }).fel).toMatch(/^Ange ett ROT-avdrag mindre än 2\s500\skr/);
    expect(h.db.tabell("kostnadsrad").length).toBe(fore);
  });

  it("ingen rad hamnar under noll när ROT ryms precis", async () => {
    seeda(249_999);
    expect(await dela(uppdelning([
      ["Privat", "7 500", "privat", ""],
      ["Arbete kök", "1 500", KOK, ""],
      ["Arbete badrum", "1 000", BADRUM, ""],
    ]))).toBe("sparad");
    expect(await bidrag(KOK)).toBeGreaterThanOrEqual(0);
    expect(await bidrag(BADRUM)).toBeGreaterThanOrEqual(0);
    expect((await bidrag(KOK)) + (await bidrag(BADRUM))).toBe(1);
  });
});
