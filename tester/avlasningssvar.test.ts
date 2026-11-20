import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Avläsningens svar sparas med kvittot (docs/design.md, "Modellens svar sparas
// med kvittot"; docs/produktspec.md, datamodellen). Tre villkor gör det
// försvarbart, och provet mäter dem: svaret sparas som det kom, det går inte
// vidare till webbläsaren, och det raderas med kvittot – på varje väg som tar
// bort en bilaga. Efter en radering söks varje tabell igenom efter svaret,
// inte bara bilagan, så att ett svar som blivit liggande någon annanstans
// också syns.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
    modellsvar: "",
    borttagna: [] as string[],
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
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
  skapaServerklient: async () => ({ auth: { getUser: async () => ({ data: { user: h.inloggad } }) } }),
}));
// En riktig PNG, 1 × 1 bildpunkt: metadatan rensas före anropet och en fil som
// inte går att läsa skickas inte.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({
    download: async () => ({ data: { arrayBuffer: async () => PNG.buffer }, error: null }),
    remove: async (nycklar: string[]) => {
      h.borttagna.push(...nycklar);
      return { data: [], error: null };
    },
  }),
  lagringsklient: () => ({}),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async () => ({ content: [{ type: "text", text: h.modellsvar }], stop_reason: "end_turn" }),
    };
  },
}));

import { analyseraBilaga } from "@/app/kostnad/bilaga-actions";
import { taBortBilagaAction, taBortUtkastRad } from "@/app/kostnad/[id]/actions";

const ANNA = "a0000000-0000-4000-8000-0000000000d1";
const X = "b0000000-0000-4000-8000-0000000000d1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Ett svar med en markör som inte finns någon annanstans i databasen. */
const SVAR =
  '{"dokumentdatum":"2026-03-02","betaldatum":"2026-03-14","valuta":"SEK","leverantor":"Svarsmarkören Bygg AB","att_betala":43807.5,"rot_utnyttjat":6480,"rot_avraknat":true,"rot_avraknat_citat":"Att betala efter ROT-avdrag","netto":null,"moms":null,"summa_fore_rot":null}';
/** Citatet står bara i det råa svaret – leverantören står också i det tolkade. */
const MARKOR = "Att betala efter ROT-avdrag";

function seeda(): { kostnadId: string; bilagaId: string } {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", { id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01") });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  const k = db.lagg("kostnad", { bostad_id: X, totalbelopp: null });
  const b = db.lagg("bilaga", {
    kostnad_id: k.id, lagringsnyckel: `${X}/${k.id}/a.png`, filnamn: "faktura.png", mimetyp: "image/png",
    storlek: PNG.length, uppladdning_bekraftad: true, dokument_analyserad: false,
  });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
  h.modellsvar = SVAR;
  h.borttagna.length = 0;
  process.env.ANTHROPIC_API_KEY = "prov";
  return { kostnadId: k.id as string, bilagaId: b.id as string };
}

/** Varje rad i varje tabell där svaret står, som text. */
function svaretKvar(): string[] {
  return Object.entries(h.db.ogonblick()).flatMap(([modell, rader]) =>
    (rader as unknown[]).filter((rad) => JSON.stringify(rad).includes(MARKOR)).map(() => modell),
  );
}

const formular = (varden: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(varden)) f.set(k, v);
  return f;
};

beforeEach(() => vi.clearAllMocks());

describe("svaret sparas med kvittot, och bara där", () => {
  it("som det kom, på bilagan – och inte i det webbläsaren får", async () => {
    const { bilagaId } = seeda();
    const tillbaka = await analyseraBilaga({ bilagaId });
    expect(tillbaka.kord, "förutsättningen: avläsningen gjordes").toBe(true);
    expect(h.db.tabell("bilaga").find((b) => b.id === bilagaId)!.avlasningssvar).toBe(SVAR);
    expect(Object.keys(tillbaka).sort()).toEqual(["falt", "kord"]);
    expect(JSON.stringify(tillbaka)).not.toContain(MARKOR);
  });

  it("inget svar – ingen nyckel – ger tomt, inte en tom sträng", async () => {
    const { bilagaId } = seeda();
    delete process.env.ANTHROPIC_API_KEY;
    await analyseraBilaga({ bilagaId });
    const bilaga = h.db.tabell("bilaga").find((b) => b.id === bilagaId)!;
    expect(bilaga.dokument_analyserad, "förutsättningen: avläsningen försöktes").toBe(true);
    expect(bilaga.avlasningssvar).toBeNull();
  });
});

describe("svaret raderas med kvittot", () => {
  it("ett raderat kvitto lämnar inget svar kvar, i någon tabell", async () => {
    const { kostnadId, bilagaId } = seeda();
    await analyseraBilaga({ bilagaId });
    expect(svaretKvar(), "förutsättningen: svaret sparades").toEqual(["bilaga"]);
    const ut = await taBortUtkastRad({}, formular({ kostnad_id: kostnadId }));
    expect(ut.fel).toBeUndefined();
    expect(h.borttagna, "förutsättningen: filen togs bort i samma operation").toContain(`${X}/${kostnadId}/a.png`);
    expect(svaretKvar()).toEqual([]);
  });

  it("en raderad bilaga lämnar inget svar kvar – kvittot står kvar", async () => {
    const { kostnadId, bilagaId } = seeda();
    await analyseraBilaga({ bilagaId });
    expect(svaretKvar(), "förutsättningen").toEqual(["bilaga"]);
    const ut = await taBortBilagaAction({}, formular({ bilaga_id: bilagaId, kostnad_id: kostnadId }));
    expect(ut.ok).toBe(true);
    expect(h.db.tabell("kostnad").map((k) => k.id)).toEqual([kostnadId]);
    expect(svaretKvar()).toEqual([]);
  });
});
