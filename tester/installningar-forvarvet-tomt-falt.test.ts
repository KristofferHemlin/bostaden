import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";


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
  usePathname: () => "/installningar",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test" }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({}),
  lagringsklient: () => ({}),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import { renderToStaticMarkup } from "react-dom/server";
import { sparaForvarvet } from "@/app/installningar/actions";
import InstallningarSida from "@/app/installningar/page";
import { formateraKronor } from "@/lib/format";
import { formateraAndel } from "@/lib/samagande";

// Ett tomt fält ändrar ingenting, på varje rad i kortet Förvärvet
// (docs/design.md, beslutat 2026-11-23). Till dess skrev inställningarna null
// när ett belopp tömdes: en köpeskilling som är obligatorisk i registreringen
// gick att radera, och startskärmens kort började fråga igen. Båda hållen
// prövas för varje belopp – ett tomt fält lämnar talet orört, ett nytt tal
// sparas – och att hon ser det sparade talet på sidan efteråt, eftersom ett
// fält som tyst struntar i vad hon gjorde inte är bättre än ett som tyst
// raderar.

const ANNA = "a0000000-0000-4000-8000-0000000000e3";
const X = "b0000000-0000-4000-8000-0000000000e3";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const FALTEN = [
  { namn: "köpeskillingen", falt: "kopeskilling", etikett: "Köpeskilling", sparad: 325_000_000n, nytt: "3 400 000", nyttOren: 340_000_000n },
  { namn: "köpkostnaderna", falt: "kopkostnader", etikett: "Köpkostnader", sparad: 4_500_000n, nytt: "52 000", nyttOren: 5_200_000n },
] as const;

function formular(falt: Record<string, string>): FormData {
  const fd = new FormData();
  const alla = { tilltradesdatum: "2019-06-01", kopeskilling: "", kopkostnader: "", agarandel: "100", ...falt };
  for (const [k, v] of Object.entries(alla)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  h.db.nollstall();
  for (const r of REGELPARAMETRAR) {
    h.db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  h.db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false, kopeskilling: FALTEN[0].sparad, kopkostnader: FALTEN[1].sparad,
  });
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
});

async function sparad(falt: string): Promise<bigint | null> {
  const b = (await h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } })) as Record<string, unknown>;
  const v = b[falt] as bigint | number | null | undefined;
  return v == null ? null : BigInt(v);
}

/** Radens värde på inställningssidan, som hela elementets text. */
async function radensVarde(etikett: string): Promise<string> {
  const html = renderToStaticMarkup((await InstallningarSida({ searchParams: Promise.resolve({}) })) as Parameters<typeof renderToStaticMarkup>[0]);
  const rader = [...html.matchAll(new RegExp(`<span class="text-text-sekundar">${etikett}</span><span[^>]*>([^<]*)</span>`, "g"))];
  expect(rader, `raden ${etikett} på sidan`).toHaveLength(1);
  return rader[0][1];
}

describe.each(FALTEN)("$namn i inställningarna går inte att radera", ({ falt, etikett, sparad: tal, nytt, nyttOren }) => {
  it("förutsättningen: sidan visar det sparade talet före sparandet", async () => {
    expect(await radensVarde(etikett)).toBe(formateraKronor(Number(tal)));
  });

  it("ett tömt fält lämnar det sparade talet orört, och sidan visar det", async () => {
    const svar = await sparaForvarvet({}, formular({ [falt]: "" }));
    expect(svar.fel).toBeUndefined();
    expect(await sparad(falt)).toBe(tal);
    expect(await radensVarde(etikett)).toBe(formateraKronor(Number(tal)));
  });

  it("ett fält med bara mellanslag är också tomt", async () => {
    const svar = await sparaForvarvet({}, formular({ [falt]: "   " }));
    expect(svar.fel).toBeUndefined();
    expect(await sparad(falt)).toBe(tal);
  });

  it("ett nytt tal sparas som vanligt, och sidan visar det nya", async () => {
    const svar = await sparaForvarvet({}, formular({ [falt]: nytt }));
    expect(svar.fel).toBeUndefined();
    expect(await sparad(falt)).toBe(nyttOren);
    expect(await radensVarde(etikett)).toBe(formateraKronor(Number(nyttOren)));
  });

  it("och resten av kortet sparas när fältet lämnas tomt", async () => {
    const svar = await sparaForvarvet({}, formular({ [falt]: "", tilltradesdatum: "2020-02-03" }));
    expect(svar.fel).toBeUndefined();
    const b = await h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } });
    expect((b.tilltradesdatum as Date).toISOString().slice(0, 10)).toBe("2020-02-03");
    expect(await sparad(falt)).toBe(tal);
  });
});

// Tillträdesdatumet och ägarandelen stoppade hela kortet när de var tomma, i
// stället för att lämna sitt värde orört (ändrat 2026-11-23, docs/design.md,
// "Kortet Förvärvet"). Kravet gäller värdet, inte sparandet: datumet kan inte
// bli tomt, och en sparad andel kan inte raderas – men resten av kortet sparas.
// Det felet faktiskt kostade var ändringen på en annan rad, så den prövas.
async function andelen(): Promise<number | null> {
  const m = (await h.db.klient.medlemskap.findFirst({ where: { anvandare_id: ANNA, bostad_id: X } })) as { agarandel: unknown } | null;
  return m?.agarandel == null ? null : Number(m.agarandel);
}

describe("tillträdesdatumet i inställningarna", () => {
  it("ett tomt fält lämnar det sparade datumet orört, ändringen på en annan rad sparas, och sidan visar datumet", async () => {
    const svar = await sparaForvarvet({}, formular({ tilltradesdatum: "", kopeskilling: "3 400 000" }));
    expect(svar.fel).toBeUndefined();
    const b = await h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } });
    expect((b.tilltradesdatum as Date).toISOString().slice(0, 10)).toBe("2019-06-01");
    expect(await sparad("kopeskilling")).toBe(340_000_000n);
    expect(await radensVarde("Tillträdesdatum")).toBe("2019-06-01");
  });

  it("ett nytt datum sparas som vanligt, och sidan visar det nya", async () => {
    const svar = await sparaForvarvet({}, formular({ tilltradesdatum: "2020-02-03" }));
    expect(svar.fel).toBeUndefined();
    expect(await radensVarde("Tillträdesdatum")).toBe("2020-02-03");
  });

  it("ett påbörjat men ofullständigt datum är inte tomt: det avvisas vid fältet, och ingenting sparas", async () => {
    const f = formular({ tilltradesdatum: "", kopeskilling: "3 400 000" });
    f.set("tilltradesdatum__paborjat", "1");
    const svar = await sparaForvarvet({}, f);
    expect(svar).toMatchObject({ falt: "tilltradesdatum" });
    expect(svar.fel).toBeTruthy();
    expect(await sparad("kopeskilling")).toBe(FALTEN[0].sparad);
  });
});

describe("ägarandelen i inställningarna", () => {
  beforeEach(async () => {
    await h.db.klient.medlemskap.updateMany({ where: { anvandare_id: ANNA, bostad_id: X }, data: { agarandel: 60 } });
  });

  it("förutsättningen: sidan visar den sparade andelen", async () => {
    expect(await andelen()).toBe(60);
    expect(await radensVarde("Ägarandel")).toBe(formateraAndel(60));
  });

  it("ett tomt fält lämnar den sparade andelen orörd, ändringen på en annan rad sparas, och sidan visar andelen", async () => {
    const svar = await sparaForvarvet({}, formular({ agarandel: "", kopeskilling: "3 400 000" }));
    expect(svar.fel).toBeUndefined();
    expect(await andelen()).toBe(60);
    expect(await sparad("kopeskilling")).toBe(340_000_000n);
    expect(await radensVarde("Ägarandel")).toBe(formateraAndel(60));
  });

  it("en ny andel sparas som vanligt, och sidan visar den nya", async () => {
    const svar = await sparaForvarvet({}, formular({ agarandel: "50" }));
    expect(svar.fel).toBeUndefined();
    expect(await andelen()).toBe(50);
    expect(await radensVarde("Ägarandel")).toBe(formateraAndel(50));
  });
});
