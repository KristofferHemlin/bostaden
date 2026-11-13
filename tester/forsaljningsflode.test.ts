// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Försäljningsflödets ordning (produktspec 4.1, "De ställs först av allt vid
// försäljningen, och ordningen är härledd"): datum, bostadsfrågorna, skicket
// vid försäljningen, samma del, ägarandelen, underlaget. Bostadsfrågorna står
// först för att ett ja släcker hela reparationsgrenen – då ställs skickfrågan
// inte alls.
//
// Ordningen bor i en ren funktion (src/doman/forsaljningsflode.ts), som provas
// för sig, och stegen provas mot en falsk databas: vart varje steg skickar
// henne, givet bostaden.

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
  usePathname: () => "/forsaljning",
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

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { markeraSald } from "@/app/forsaljning/actions";
import { sparaBostadsfragorVidForsaljning } from "@/app/forsaljning/bostaden/actions";
import BostadsfragorSida from "@/app/forsaljning/bostaden/page";
import SammaDelSida from "@/app/forsaljning/samma-del/page";
import SkickSida from "@/app/forsaljning/skick/page";
import ExportSida from "@/app/export/page";
import {
  FORSALJNINGSSTEG,
  nastaForsaljningssteg,
  type Forsaljningslage,
} from "@/doman/forsaljningsflode";
import { byggK6aExport, VantarPaBostadsfragor } from "@/doman/export-k6a";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-0000000000b1";
const X = "b0000000-0000-4000-8000-0000000000b1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

interface Seed {
  upplatelseform?: "bostadsratt" | "fastighet";
  nybyggd?: boolean | null;
  ombildning?: boolean | null;
  sald?: boolean;
  bekraftad?: boolean;
  /** Ett utbyte med reparationsdel vars skick vid försäljningen saknas. */
  utbyteUtanSkick?: boolean;
}

function seeda({
  upplatelseform = "fastighet",
  nybyggd = null,
  ombildning = null,
  sald = false,
  bekraftad = false,
  utbyteUtanSkick = true,
}: Seed = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform, tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: nybyggd, ombildning_fran_hyresratt: ombildning,
    ...(sald ? { forsaljningsdatum: datum("2026-09-15") } : {}),
  });
  db.lagg("medlemskap", {
    anvandare_id: ANNA, bostad_id: X, agarandel: 100, ...(bekraftad ? { bekraftad_andel: 100 } : {}),
  });
  if (utbyteUtanSkick) {
    const p = db.lagg("projekt", {
      bostad_id: X, namn: "Nya fönster", ar: 2025, atgardstyp: "utbytt",
      battre_kvalitet: false, skick_forvarv: 1,
    });
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Fönsterfabriken", totalbelopp: 4_800_000,
      dokumentdatum: datum("2025-04-02"), betaldatum: datum("2025-04-02"),
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Fönster", belopp: 4_800_000 });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: p.id, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
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

const salj = () => markeraSald({}, fd({ forsaljningsdatum: "2026-09-15", forsaljningspris: "" }));

beforeEach(() => seeda());

describe("ordningen, som ren funktion", () => {
  const allt: Forsaljningslage = {
    bostadsfragorBesvarade: false,
    reparationsgrenenSlackt: false,
    skickAttBedoma: true,
    sammaDelVisas: true,
    andelBekraftad: false,
  };

  it("står i specens ordning", () => {
    expect(FORSALJNINGSSTEG).toEqual(["bostadsfragor", "skick", "samma_del", "andel", "export"]);
  });

  it("när allt gäller går varje steg till nästa", () => {
    const besvarade = { ...allt, bostadsfragorBesvarade: true };
    expect(nastaForsaljningssteg("datum", allt)).toBe("bostadsfragor");
    expect(nastaForsaljningssteg("bostadsfragor", besvarade)).toBe("skick");
    expect(nastaForsaljningssteg("skick", besvarade)).toBe("samma_del");
    expect(nastaForsaljningssteg("samma_del", besvarade)).toBe("andel");
    expect(nastaForsaljningssteg("andel", besvarade)).toBe("export");
  });

  it("en släckt reparationsgren hoppar över skicket, även med åtgärder som saknar svar", () => {
    const nybyggd = { ...allt, bostadsfragorBesvarade: true, reparationsgrenenSlackt: true, sammaDelVisas: false };
    expect(nastaForsaljningssteg("bostadsfragor", nybyggd)).toBe("andel");
  });

  it("obesvarade bostadsfrågor kommer före skicket, aldrig efter", () => {
    expect(nastaForsaljningssteg("datum", allt)).toBe("bostadsfragor");
    // Ingen väg förbi dem till skicket eller samma del.
    for (const efter of ["datum", "bostadsfragor", "skick"] as const) {
      expect(["skick", "samma_del"]).not.toContain(nastaForsaljningssteg(efter, allt));
    }
  });
});

describe("stegen, mot databasen", () => {
  it("markera som såld leder först till bostadsfrågorna när de är obesvarade", async () => {
    expect(await omdirigeringFran(salj)).toBe("/forsaljning/bostaden");
  });

  it("besvarade bostadsfrågor hoppas över – datumet leder till skicket", async () => {
    seeda({ nybyggd: false });
    expect(await omdirigeringFran(salj)).toBe("/forsaljning/skick");
  });

  it("nej på första ägaren leder till skicket", async () => {
    seeda({ sald: true });
    const till = await omdirigeringFran(() =>
      sparaBostadsfragorVidForsaljning({}, fd({ forsta_agare: "nej" })),
    );
    expect(till).toBe("/forsaljning/skick");
    expect(h.db.tabell("bostad")[0].nybyggd_vid_forvarv).toBe(false);
  });

  it("ja på en nybyggd villa släcker skicket – flödet går till andelen", async () => {
    seeda({ sald: true });
    const till = await omdirigeringFran(() =>
      sparaBostadsfragorVidForsaljning({}, fd({ forsta_agare: "ja" })),
    );
    expect(till).toBe("/forsaljning/andel");
    // Skicket är fortfarande obesvarat; det har inget tal att ändra.
    expect(h.db.tabell("projekt")[0].skick_forsaljning).toBeNull();
  });

  it("ja och ombildning på en bostadsrätt tänder grenen igen – skicket ställs", async () => {
    seeda({ sald: true, upplatelseform: "bostadsratt" });
    const till = await omdirigeringFran(() =>
      sparaBostadsfragorVidForsaljning({}, fd({ forsta_agare: "ja", ombildning: "ja" })),
    );
    expect(till).toBe("/forsaljning/skick");
  });

  it("ja på en bostadsrätt utan ombildningssvar sparas inte", async () => {
    seeda({ sald: true, upplatelseform: "bostadsratt" });
    const fore = h.db.ogonblick();
    const svar = await sparaBostadsfragorVidForsaljning({}, fd({ forsta_agare: "ja" }));
    expect(svar.fel).toBe("Svara på om du köpte bostaden i samband med en ombildning från hyresrätt.");
    expect(h.db.ogonblick()).toEqual(fore);
  });

  it("med bekräftad andel och släckt gren går flödet ända till underlaget", async () => {
    seeda({ sald: true, bekraftad: true });
    const till = await omdirigeringFran(() =>
      sparaBostadsfragorVidForsaljning({}, fd({ forsta_agare: "ja" })),
    );
    expect(till).toBe("/export");
  });

  it("före försäljningen leder svaret tillbaka till underlaget", async () => {
    const till = await omdirigeringFran(() =>
      sparaBostadsfragorVidForsaljning({}, fd({ forsta_agare: "nej" })),
    );
    expect(till).toBe("/export");
  });

  it("skickfrågorna för en nybyggd bostad ställs aldrig – sidan går vidare", async () => {
    seeda({ sald: true, nybyggd: true });
    expect(await omdirigeringFran(() => SkickSida())).toBe("/forsaljning/andel");
  });

  it("skickfrågorna utan bostadsfrågorna går till bostadsfrågorna", async () => {
    seeda({ sald: true });
    expect(await omdirigeringFran(() => SkickSida())).toBe("/forsaljning/bostaden");
  });

  it("frågan om samma del utan bostadsfrågorna går till bostadsfrågorna", async () => {
    seeda({ sald: true });
    expect(await omdirigeringFran(() => SammaDelSida())).toBe("/forsaljning/bostaden");
  });

  it("skickfrågorna, med grenen tänd, ställs för åtgärden som saknar svar", async () => {
    seeda({ sald: true, nybyggd: false });
    const html = renderToStaticMarkup(await SkickSida());
    expect(html).toContain("Nya fönster");
  });
});

describe("talen ändras inte", () => {
  // Beräkningen väntar på svaren som förut; det enda som flyttat är var
  // frågan ställs.
  it("obesvarad nybyggd_vid_forvarv kastar VantarPaBostadsfragor, ett besvarat nej gör det inte", () => {
    const indata = (nybyggd: boolean | null) => ({
      bostad: { upplatelseform: "fastighet" as const, tilltradesdatum: "2019-06-01", forsaljningsdatum: "2026-09-15", nybyggd_vid_forvarv: nybyggd },
      medlemskap: { agarandel: 100 },
      projekt: [{ id: "p", namn: "Fönster", atgardstyp: "utbytt" as const, battre_kvalitet: false, merkostnad: null, merkostnad_bas: null, skick_forvarv: 1, skick_forsaljning: 4, tidigare_gang_samma_del: false }],
      kostnader: [{ id: "k", totalbelopp: 4_800_000, betaldatum: "2025-04-02", dokumentdatum: "2025-04-02", rot_utnyttjat: 0, forsakringsersattning: 0, arkiverad: false, rader: [{ artikel: "Fönster", belopp: 4_800_000, fordelningar: [{ projekt_id: "p", privat: false, andel: 1 }] }] }],
      kostnader_med_bilaga: ["k"],
      regelparametrar: REGELPARAMETRAR,
    });
    expect(() => byggK6aExport(indata(null))).toThrow(VantarPaBostadsfragor);
    expect(() => byggK6aExport(indata(false))).not.toThrow();
  });
});

describe("bostadsfrågornas sida", () => {
  // Lydelsen ur produktspec 4.1, läst inne i testet (CLAUDE.md, Tester).
  function specensFraga(): { fraga: string; hjalp: string } {
    const spec = readFileSync(join(process.cwd(), "docs", "produktspec.md"), "utf-8");
    const m = spec.match(/^> \*\*(Var du första ägaren av bostaden\?)\*\*\n> (.+)$/m);
    if (!m) throw new Error("produktspec.md saknar frågan om första ägaren");
    return { fraga: m[1], hjalp: m[2] };
  }

  it("ställer frågan om första ägaren med specens lydelse, och ombildningen först efter ett ja på en bostadsrätt", async () => {
    seeda({ sald: true, upplatelseform: "bostadsratt" });
    const { fraga, hjalp } = specensFraga();
    const behallare = document.createElement("div");
    document.body.appendChild(behallare);
    const rot = createRoot(behallare);
    await act(async () => rot.render(await BostadsfragorSida()));
    const legender = () => [...behallare.querySelectorAll("legend")].map((l) => l.textContent);
    expect(legender()).toEqual([fraga]);
    expect([...behallare.querySelectorAll("[data-hjalpruta]")].map((e) => e.textContent)).toEqual([hjalp]);
    const ja = [...behallare.querySelectorAll("button")].find((b) => b.textContent === "Ja")!;
    await act(async () => ja.click());
    expect(legender()).toEqual([fraga, "Köpte du bostaden i samband med ombildning från hyresrätt?"]);
    act(() => rot.unmount());
    behallare.remove();
  });

  it("underlaget som väntar på svaren leder hit, inte till genomgången", async () => {
    seeda({ sald: true });
    const html = renderToStaticMarkup(await ExportSida());
    const div = document.createElement("div");
    div.innerHTML = html;
    const lank = [...div.querySelectorAll("a")].find((a) => a.textContent === "Svara på frågorna");
    expect(lank?.getAttribute("href")).toBe("/forsaljning/bostaden");
  });
});
