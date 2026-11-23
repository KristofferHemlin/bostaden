// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Idag är en dag i en svensk kalender (CLAUDE.md, "Ett datum utan sin tidszon
// är inte en dag"). Räknades den i UTC flyttades dygnsgränsen en timme in i
// natten på vintern och två på sommaren, och den som skrev in dagens datum
// strax efter midnatt fick höra att det låg i framtiden – vid försäljningen
// och för tillträdet, i webbläsaren och på servern.
//
// Klockan ställs till strax efter midnatt i Stockholm, när UTC ännu är kvar
// på gårdagen. Och processens tidszon sätts uttryckligen, i flera zoner: en
// lagning som läser maskinens egen zon i stället för Stockholms går igenom på
// en svensk dator och faller på en server i UTC – där fel svar syns.

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

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { markeraSald } from "@/app/forsaljning/actions";
import { sparaForvarvet } from "@/app/installningar/actions";
import { slutforRegistrering } from "@/app/registrera/actions";
import { DatumFalt } from "@/components/datum-falt";
import { REGELPARAMETRAR } from "./_hjalp";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-0000000000d7";
const X = "b0000000-0000-4000-8000-0000000000d7";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Strax efter midnatt i Stockholm, medan UTC ännu är kvar på gårdagen. */
const OGONBLICK = [
  { namn: "vintertid, 00:30", nu: "2026-11-23T23:30:00.000Z", idag: "2026-11-24", imorgon: "2026-11-25" },
  { namn: "sommartid, 01:30", nu: "2026-06-15T23:30:00.000Z", idag: "2026-06-16", imorgon: "2026-06-17" },
];
/** UTC är där en lagning på maskinens zon skulle falla; de andra för säkerhets skull. */
const ZONER = ["UTC", "America/New_York", "Europe/Stockholm", "Asia/Tokyo"];

const ursprungligZon = process.env.TZ;

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet", tilltradesdatum: datum("2021-03-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: null,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100, bekraftad_andel: 100 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function fd(falt: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(falt)) f.set(k, v);
  return f;
}

/** Ett serveranrop: dess fel, eller null när det gick igenom (en omdirigering är ett lyckat sparande). */
async function felet(anrop: () => Promise<{ fel?: string } | unknown>): Promise<string | null> {
  try {
    const svar = (await anrop()) as { fel?: string } | undefined;
    return svar?.fel ?? null;
  } catch (e) {
    if (e instanceof h.Omdirigering) return null;
    throw e;
  }
}

const SERVERN: Record<string, (dag: string) => Promise<string | null>> = {
  "försäljningen": (dag) => felet(() => markeraSald({}, fd({ forsaljningsdatum: dag, forsaljningspris: "" }))),
  "tillträdet i inställningarna": (dag) =>
    felet(() => sparaForvarvet({}, fd({ tilltradesdatum: dag, kopeskilling: "3 250 000", kopkostnader: "", agarandel: "100" }))),
  "tillträdet i registreringen": (dag) => {
    // Registreringen skapar bostaden, så kontot får ingen innan.
    h.db.nollstall();
    h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
    return felet(() =>
      slutforRegistrering(
        {},
        fd({ fas: "bostad", upplatelseform: "fastighet", tilltradesdatum: dag, adress: "Kvarnvägen 3", kopeskilling: "3 250 000" }),
      ),
    );
  },
};

const FRAMTID = /kan inte ligga i framtiden/;

let behallare: HTMLDivElement | null = null;
let rot: Root | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  seeda();
});

afterEach(() => {
  if (rot) act(() => rot!.unmount());
  behallare?.remove();
  rot = null;
  behallare = null;
  vi.useRealTimers();
  if (ursprungligZon === undefined) delete process.env.TZ;
  else process.env.TZ = ursprungligZon;
});

/** Skriver som en användare: ett input-event per tecken. */
async function skriv(input: HTMLInputElement, text: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  for (const tecken of text) {
    await act(async () => {
      satt.call(input, input.value + tecken);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

/** Datumfältet i webbläsaren, med framtidsspärren som försäljningen och tillträdet använder. */
async function webblasarensBesked(dag: string): Promise<string> {
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () =>
    rot!.render(createElement(DatumFalt, { name: "datum", framtidsFelmeddelande: "Datumet kan inte ligga i framtiden." })),
  );
  const [ar, manad, dagFalt] = ["ÅÅÅÅ", "MM", "DD"].map(
    (p) => behallare!.querySelector<HTMLInputElement>(`input[placeholder="${p}"]`)!,
  );
  expect([ar, manad, dagFalt].every(Boolean), "förutsättningen: datumfältets tre rutor").toBe(true);
  const [a, m, d] = dag.split("-");
  await skriv(ar, a);
  await skriv(manad, m);
  await skriv(dagFalt, d);
  const dold = behallare.querySelector<HTMLInputElement>('input[type="hidden"][name="datum"]');
  return `${behallare.textContent ?? ""}|värde=${dold?.value ?? "(inget dolt fält)"}`;
}

describe.each(ZONER)("processens tidszon %s", (zon) => {
  describe.each(OGONBLICK)("$namn i Stockholm", ({ nu, idag, imorgon }) => {
    beforeEach(() => {
      process.env.TZ = zon;
      vi.setSystemTime(new Date(nu));
      // Förutsättningen: UTC står kvar på gårdagen, så fel zon ger fel dag.
      expect(new Date().toISOString().slice(0, 10), "UTC-dagen").not.toBe(idag);
    });

    it.each(Object.keys(SERVERN))("servern: %s tar emot dagens datum och avvisar morgondagens", async (stalle) => {
      expect(await SERVERN[stalle](idag), `${stalle}, ${idag}`).toBeNull();
      seeda();
      expect(await SERVERN[stalle](imorgon), `${stalle}, ${imorgon}`).toMatch(FRAMTID);
    });

    it("webbläsaren: datumfältet tar emot dagens datum", async () => {
      const besked = await webblasarensBesked(idag);
      expect(besked).not.toMatch(FRAMTID);
      expect(besked).toContain(`värde=${idag}`);
    });

    it("webbläsaren: och avvisar morgondagens", async () => {
      expect(await webblasarensBesked(imorgon)).toMatch(FRAMTID);
    });
  });
});

// Varje ställe i src/ som läser klockan räknas upp ur koden, och vart och ett
// står i listan med vad det använder ögonblicket till. Ett ögonblick som blir
// en dag går genom idagISverige eller aretISverige; ingenting får göra en dag
// av klockan på egen hand (CLAUDE.md, "Det ska finnas ett sätt att fråga
// vilken dag det är"). En ny läsning av klockan fälls tills den står här.
const KLOCKAN_LASES: Record<string, string> = {
  "src/lib/datum.ts": "idagISverige och aretISverige – de enda som gör en dag av klockan",
  "src/lib/inbjudan.ts": "besvarad_at, en tidsstämpel – ett ögonblick, ingen dag",
  "src/app/registrera/adress-falt.tsx": "en sessionsnyckel för adressförslagen – ingen tid alls",
  "src/lib/sakerhetskopior/rensning.ts":
    "säkerhetskopiornas ålder i maskinens tid; kopiorna namnges och läses i samma zon, på samma dator",
};

/** En läsning av klockan: ett Date utan argument, eller Date.now(). Kommentarer räknas inte. */
const KLOCKAN = /new Date\(\)|Date\.now\(\)/;
/** En dag eller ett år ur klockan utan att gå genom Stockholm. */
const DAG_UR_KLOCKAN = /sparadDag\(new Date\(\)\)|new Date\(\)\.(getUTCFullYear|getFullYear|toISOString|getUTCDate|getDate)\(\)/;

async function filerSom(villkor: (kod: string) => boolean): Promise<string[]> {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const traffar: string[] = [];
  const ga = (katalog: string) => {
    for (const d of readdirSync(join(process.cwd(), katalog), { withFileTypes: true })) {
      const fil = join(katalog, d.name);
      if (d.isDirectory()) ga(fil);
      else if (/\.tsx?$/.test(d.name)) {
        const kod = readFileSync(join(process.cwd(), fil), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        if (villkor(kod)) traffar.push(fil);
      }
    }
  };
  ga("src");
  return traffar.sort();
}

describe("varje väg från klockan till en dag", () => {
  it("ingen fil gör en dag av klockan på egen hand", async () => {
    expect(await filerSom((kod) => DAG_UR_KLOCKAN.test(kod))).toEqual([]);
  });

  it("varje läsning av klockan står i listan, med vad den används till", async () => {
    expect(await filerSom((kod) => KLOCKAN.test(kod))).toEqual(Object.keys(KLOCKAN_LASES).sort());
  });

  it("sparadDag vägrar ett ögonblick, och säger var dagens datum finns", async () => {
    const { sparadDag } = await import("@/lib/format");
    vi.setSystemTime(new Date("2026-11-23T23:30:00.000Z"));
    expect(() => sparadDag(new Date())).toThrow(/idagISverige/);
    expect(sparadDag(new Date("2026-11-23T00:00:00.000Z"))).toBe("2026-11-23");
  });

  it("och gränserna mot idag läser idagISverige", async () => {
    const { readFileSync } = await import("node:fs");
    for (const fil of [
      "src/app/forsaljning/actions.ts",
      "src/app/installningar/actions.ts",
      "src/app/registrera/actions.ts",
      "src/app/registrera/flode.tsx",
      "src/components/datum-falt.tsx",
    ]) {
      expect(readFileSync(fil, "utf8"), fil).toMatch(/idagISverige\(\)/);
    }
  });
});
