import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Den tidigaste dag appen tar emot står en gång, TIDIGASTE_DATUM i
// src/lib/datum.ts (till 2026-11-23 på sex ställen). Varje väg som prövar
// gränsen prövas här mot konstanten: dagen före avvisas med sitt fälts namn
// och vid sitt fält, och dagen själv går igenom gränsen. En kopia av gränsen
// med ett annat värde fälls av det senare; en ordagrann kopia fälls av
// uppräkningen sist i filen. Webbläsarsidan prövas i
// tester/tidigaste-datum-dom.test.ts.

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
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));

import { markeraSald } from "@/app/forsaljning/actions";
import { sparaForvarvet } from "@/app/installningar/actions";
import { redigeraKostnad } from "@/app/kostnad/[id]/actions";
import { slutforRegistrering } from "@/app/registrera/actions";
import { fortidigtDatumFel, TIDIGASTE_ARET, TIDIGASTE_DATUM } from "@/lib/datum";
import { tolkaKostnadsformular } from "@/lib/kostnadsformular";

const ANNA = "a0000000-0000-4000-8000-0000000000d8";
const X = "b0000000-0000-4000-8000-0000000000d8";
const K = "c0000000-0000-4000-8000-0000000000d8";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Dagen före gränsen, räknad ur konstanten. */
const DAGEN_FORE = (() => {
  const d = datum(TIDIGASTE_DATUM);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  // Tillträdet före gränsen, så att försäljningens tillträdesprov inte skymmer den.
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet", tilltradesdatum: datum("1960-01-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100, bekraftad_andel: 100 });
  const k = db.lagg("kostnad", {
    id: K, bostad_id: X, leverantor: "Byggmax", anteckning: null, totalbelopp: 100_000,
    dokumentdatum: datum("2020-05-02"), betaldatum: datum("2020-05-02"), skapad_at: datum("2026-01-01"),
  });
  db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Byggmax", belopp: 100_000 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function fd(falt: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(falt)) f.set(k, v);
  return f;
}

async function svaret(anrop: () => Promise<unknown>): Promise<{ fel?: string; falt?: string }> {
  try {
    return ((await anrop()) as { fel?: string; falt?: string }) ?? {};
  } catch (e) {
    if (e instanceof h.Omdirigering) return {};
    throw e;
  }
}

const VAGARNA: { namn: string; vad: string; falt: string; prova: (dag: string) => Promise<{ fel?: string; falt?: string }> }[] = [
  {
    namn: "försäljningen",
    vad: "Försäljningsdatum",
    falt: "forsaljningsdatum",
    prova: (dag) => svaret(() => markeraSald({}, fd({ forsaljningsdatum: dag, forsaljningspris: "" }))),
  },
  {
    namn: "tillträdet i inställningarna",
    vad: "Tillträdesdatum",
    falt: "tilltradesdatum",
    prova: (dag) => svaret(() => sparaForvarvet({}, fd({ tilltradesdatum: dag, kopeskilling: "", kopkostnader: "", agarandel: "100" }))),
  },
  {
    namn: "tillträdet i registreringen",
    vad: "Tillträdesdatum",
    falt: "tilltradesdatum",
    prova: (dag) => {
      h.db.nollstall();
      h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
      return svaret(() =>
        slutforRegistrering({}, fd({ fas: "bostad", upplatelseform: "fastighet", tilltradesdatum: dag, adress: "Kvarnvägen 3", kopeskilling: "3 250 000" })),
      );
    },
  },
  {
    namn: "betaldagen i inmatningen",
    vad: "Datum",
    falt: "betaldatum",
    prova: async (dag) => {
      const r = tolkaKostnadsformular(fd({ leverantor: "Byggmax", totalbelopp: "1 000", betaldatum: dag, dokumentdatum: dag }));
      const fel = "felen" in r ? r.felen.find((f) => f.falt === "betaldatum") : undefined;
      return fel ? { fel: fel.fel, falt: fel.falt } : {};
    },
  },
  {
    namn: "betaldagen i kvittots ändringsläge",
    vad: "Betaldatum",
    falt: "betaldatum",
    prova: (dag) =>
      svaret(() =>
        redigeraKostnad({}, fd({ kostnad_id: K, leverantor: "Byggmax", dokumentdatum: "2020-05-02", betaldatum: dag, projekt_id: "", anteckning: "" })),
      ),
  },
];

beforeEach(seeda);

describe("gränsen 1970, en gång", () => {
  it("förutsättningen: dagen före är ett giltigt datum före gränsen", () => {
    expect(DAGEN_FORE < TIDIGASTE_DATUM).toBe(true);
    expect(fortidigtDatumFel("Tillträdesdatum")).toBe(`Tillträdesdatum före ${TIDIGASTE_ARET} stöds inte.`);
  });

  describe.each(VAGARNA)("$namn", ({ vad, falt, prova }) => {
    it("avvisar dagen före gränsen, vid sitt fält", async () => {
      expect(await prova(DAGEN_FORE)).toMatchObject({ fel: fortidigtDatumFel(vad), falt });
    });

    it("släpper igenom gränsens egen dag", async () => {
      expect((await prova(TIDIGASTE_DATUM)).fel ?? null).not.toBe(fortidigtDatumFel(vad));
    });
  });

  it("ingen fil i src/ skriver gränsen själv", () => {
    // Datumet som sträng, eller året som tal eller i en mening. Kommentarer räknas inte.
    const MONSTER = /\b1970\b/;
    const UNDANTAG: Record<string, string> = {
      "src/lib/datum.ts": "konstanten själv",
      "src/doman/seeddata.ts":
        "regelparametrarnas giltig_fran – det är därför gränsen finns, inte en kopia av den",
    };
    const traffar: string[] = [];
    const ga = (katalog: string) => {
      for (const d of readdirSync(join(process.cwd(), katalog), { withFileTypes: true })) {
        const fil = join(katalog, d.name);
        if (d.isDirectory()) ga(fil);
        else if (/\.tsx?$/.test(d.name)) {
          const kod = readFileSync(join(process.cwd(), fil), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
          if (MONSTER.test(kod)) traffar.push(fil);
        }
      }
    };
    ga("src");
    expect(traffar.sort()).toEqual(Object.keys(UNDANTAG).sort());
  });
});
