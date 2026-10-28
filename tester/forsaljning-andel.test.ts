import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Bekraftelsen av agarandelen vid forsaljningen (docs/design.md, "Att bjuda in
// en delägare"). Andelen ar ett utgangsvarde, satt vid inbjudan eller i
// Forvarvet, och bekraftas den vecka den betyder nagot: "ni har angett 50/50 –
// stämmer det?". Installningssidan och inbjudningskortet lovade steget lange
// innan det fanns (uppmatt 2026-10-19).
//
// Bara andelen. Anskaffningsdatum och inkopspris hor till vinstberakningen,
// som appen inte gor – ingenting i berakningen laser dem.
//
// Steget ligger efter datum och pris och fore skickfragorna. Den som inte
// bekraftat stoppas inte: underlaget visar den lagrade andelen och sager att
// den inte ar bekraftad. Andras andelen efterat ar den obekraftad igen – samma
// monster som merkostnad_bas.
//
// Provat pa det som renderas och pa serverns svar (CLAUDE.md, "Tester").

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
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
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AndelSida from "@/app/forsaljning/andel/page";
import { bekraftaAndel } from "@/app/forsaljning/andel/actions";
import { markeraSald } from "@/app/forsaljning/actions";
import { sparaForvarvet } from "@/app/installningar/actions";
import ExportSida from "@/app/export/page";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const DORIS = "a0000000-0000-4000-8000-000000000002";
const X = "b0000000-0000-4000-8000-00000000000a";
const EPOST: Record<string, string> = { [ANNA]: "anna@exempel.se", [DORIS]: "doris@exempel.se" };
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda({ doris = true, sald = false }: { doris?: boolean; sald?: boolean } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: EPOST[ANNA] });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
    forsta_agare: false,
    ...(sald ? { forsaljningsdatum: datum("2026-09-15") } : {}),
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: doris ? 50 : 100 });
  if (doris) {
    db.lagg("anvandare", { id: DORIS, epost: EPOST[DORIS] });
    db.lagg("medlemskap", { anvandare_id: DORIS, bostad_id: X, agarandel: 50 });
  }
}

function loggaIn(id: string) {
  h.inloggad = { id, email: EPOST[id] };
}

function fd(varden: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(varden)) f.set(k, v);
  return f;
}

async function omdirigeringFran(anrop: () => Promise<unknown>): Promise<string | null> {
  try {
    await anrop();
    return null;
  } catch (e) {
    if (e instanceof h.Omdirigering) return e.url;
    throw e;
  }
}

const medlemskap = (vem: string) =>
  h.db.tabell("medlemskap").find((m) => m.anvandare_id === vem && m.bostad_id === X)!;

function elementFor(nod: unknown, namn: string): ReactElement<Record<string, unknown>>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<Record<string, unknown>> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

/** Stegets innehall, renderat ur sidans eget trad. */
async function steget(nasta?: string): Promise<string> {
  const vy = await AndelSida({ searchParams: Promise.resolve(nasta ? { nasta } : {}) });
  const [innehall] = elementFor(vy, "BekraftaAndel");
  expect(innehall, "sidan visar inte steget").toBeTruthy();
  return renderToStaticMarkup(innehall);
}

/** Underlagets forsta kort – uppgifterna overst – renderat. */
async function underlagetsUppgifter(): Promise<string> {
  const vy = await ExportSida();
  return elementFor(vy, "Kort").map((k) => renderToStaticMarkup(k)).join("\n");
}

beforeEach(() => seeda());

describe("steget ligger i flodet, efter datum och pris och fore skickfragorna", () => {
  it("markera som sald leder till bekraftelsen nar andelen inte ar bekraftad", async () => {
    loggaIn(ANNA);
    const till = await omdirigeringFran(() =>
      markeraSald({}, fd({ forsaljningsdatum: "2026-09-15", forsaljningspris: "" })),
    );
    expect(till).toBe("/forsaljning/andel");
  });

  it("ar andelen redan bekraftad gar flodet direkt till skickfragorna", async () => {
    medlemskap(ANNA).bekraftad_andel = 50;
    loggaIn(ANNA);
    const till = await omdirigeringFran(() =>
      markeraSald({}, fd({ forsaljningsdatum: "2026-09-15", forsaljningspris: "" })),
    );
    expect(till).toBe("/forsaljning/skick");
  });

  it("bekraftelsen lagrar andelen och gar vidare till skickfragorna", async () => {
    seeda({ sald: true });
    loggaIn(ANNA);
    const till = await omdirigeringFran(() => bekraftaAndel({}, fd({ agarandel: "50" })));
    expect(till).toBe("/forsaljning/skick");
    expect(Number(medlemskap(ANNA).bekraftad_andel)).toBe(50);
    // Den andras bekraftelse ror den inte.
    expect(medlemskap(DORIS).bekraftad_andel).toBeNull();
  });

  it("fran underlaget gar den tillbaka till underlaget", async () => {
    seeda({ sald: true });
    loggaIn(DORIS);
    const till = await omdirigeringFran(() =>
      bekraftaAndel({}, fd({ agarandel: "50", nasta: "export" })),
    );
    expect(till).toBe("/export");
  });

  it("en ogiltig andel bekraftas inte och leder ingenstans", async () => {
    seeda({ sald: true });
    loggaIn(ANNA);
    const svar = await bekraftaAndel({}, fd({ agarandel: "500" }));
    expect(svar).toMatchObject({ falt: "agarandel" });
    expect(medlemskap(ANNA).bekraftad_andel).toBeNull();
  });
});

describe("servern vagrar en summa over 100 %", () => {
  it("en hojning som tar summan over 100 % avvisas och ingenting skrivs", async () => {
    seeda({ sald: true });
    loggaIn(ANNA);
    const svar = await bekraftaAndel({}, fd({ agarandel: "60" }));
    expect(svar.fel).toMatch(/110\u00a0%.*inte vara mer än 100 %/);
    expect(Number(medlemskap(ANNA).agarandel)).toBe(50);
    expect(medlemskap(ANNA).bekraftad_andel).toBeNull();
  });

  it("en summa som redan ar over 100 % gar inte att bekrafta, ens oforandrad", async () => {
    // Forvarvet slapper igenom en sankning av en for hog summa – men en
    // bekraftad andel maste ingå i en summa som gar ihop.
    seeda({ sald: true });
    medlemskap(ANNA).agarandel = 100;
    medlemskap(DORIS).agarandel = 100;
    loggaIn(ANNA);
    const svar = await bekraftaAndel({}, fd({ agarandel: "100" }));
    expect(svar.fel).toMatch(/200\u00a0%/);
    expect(medlemskap(ANNA).bekraftad_andel).toBeNull();
  });
});

describe("fragan stalls med det som star lagrat", () => {
  it("tva delagare: ni har angett 50/50 – stämmer det?", async () => {
    seeda({ sald: true });
    loggaIn(ANNA);
    const html = await steget();
    expect(html).toContain("Ni har angett 50/50 – stämmer det?");
    expect(html).toMatch(/<input[^>]*name="agarandel"[^>]*value="50"/);
    expect(html).toContain(EPOST[DORIS]);
  });

  it("ensam agare: du har angett att du ager 100 %", async () => {
    seeda({ doris: false, sald: true });
    loggaIn(ANNA);
    const html = await steget();
    // Hart mellanslag fore procenttecknet (formateraAndel).
    expect(html).toContain("Du har angett att du äger 100\u00a0% av bostaden – stämmer det?");
  });

  // CLAUDE.md, "Andelen ar null tills den besvarats": finns ingen andel att
  // bekrafta ar "Du har angett …" osant. Lydelsen for det laget ar inte
  // bestamd; till dess stalls ingen sadan fraga och faltet borjar tomt.
  it("ensam agare utan angiven andel: ingen fraga om vad hon angett, och faltet ar tomt", async () => {
    seeda({ doris: false, sald: true });
    medlemskap(ANNA).agarandel = null;
    loggaIn(ANNA);
    const html = await steget();
    expect(html).not.toContain("angett");
    expect(html).not.toContain("0\u00a0%");
    expect(html).toMatch(/<input[^>]*name="agarandel"[^>]*value=""/);
  });

  it("delagaren har inte svarat: ingen fraga om ni har angett, och hennes andel star som Inte angiven", async () => {
    seeda({ sald: true });
    medlemskap(DORIS).agarandel = null;
    loggaIn(ANNA);
    const html = await steget();
    expect(html).not.toContain("Ni har angett");
    expect(html).toMatch(new RegExp(`${EPOST[DORIS].replace(".", "\\.")}</span><span[^>]*>\\s*Inte angiven`));
  });

  it("inte sald: steget hor inte hemma har", async () => {
    loggaIn(ANNA);
    const till = await omdirigeringFran(() => AndelSida({ searchParams: Promise.resolve({}) }));
    expect(till).toBe("/forsaljning");
  });
});

describe("underlaget sager om andelen inte ar bekraftad, men visar sig anda", () => {
  it("den som inte bekraftat ser sin andel, att den inte ar bekraftad, och vagen dit", async () => {
    seeda({ sald: true });
    medlemskap(ANNA).bekraftad_andel = 50;
    loggaIn(DORIS);
    const html = await underlagetsUppgifter();
    expect(html).toContain("Inte bekräftad");
    expect(html).toContain('href="/forsaljning/andel?nasta=export"');
    expect(html).toContain("Förs till K5, ruta 4");
  });

  it("den som bekraftat ser ingen upplysning", async () => {
    seeda({ sald: true });
    medlemskap(ANNA).bekraftad_andel = 50;
    loggaIn(ANNA);
    expect(await underlagetsUppgifter()).not.toContain("Inte bekräftad");
  });

  it("andras andelen efterat ar den obekraftad igen", async () => {
    seeda({ sald: true });
    medlemskap(ANNA).bekraftad_andel = 50;
    loggaIn(ANNA);
    const svar = await sparaForvarvet(
      {},
      fd({ tilltradesdatum: "2019-06-01", kopeskilling: "", kopkostnader: "", agarandel: "40", forsta_agare: "nej" }),
    );
    expect(svar.fel).toBeUndefined();
    expect(await underlagetsUppgifter()).toContain("Inte bekräftad");
  });

  it("fore forsaljningen fragas ingenting", async () => {
    loggaIn(ANNA);
    expect(await underlagetsUppgifter()).not.toContain("Inte bekräftad");
  });
});
