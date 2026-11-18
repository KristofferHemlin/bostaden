// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Ett kvittoutkast minns det hon skrev (docs/design.md), och gransen till ett
// sparat kvitto flyttar inte av det. totalbelopp IS NULL ar definitionen av
// ett utkast (arUtkast); beloppet hon skriver ligger i utkast_belopp. Det ar
// hela skalet till att kolumnen finns, och det enda som kan ga tyst fel: ett
// belopp i fel kolumn gor utkastet till ett kvitto i varje lista och summa.
//
// Utkastet skrivs genom den riktiga sparaUtkastfalten. Provet gors fran BADA
// hallen (CLAUDE.md, "Ett villkorat beteende prövas från båda hållen"): samma
// rad med beloppet i totalbelopp ska ge ett kvitto pa varje stalle, annars
// sager likheten ingenting om gransen.
//
// Utkastet far ocksa en kostnadsrad pa projektet. Ett utkast har ingen i
// verkligheten – raderna skapas forst nar det sparas – men utan den kan
// arssumman och troskeln inte visa att det ar gransen som haller utkastet
// utanfor, och inte bara att det saknar rader.

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
  usePathname: () => "/kostnad",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
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
  bilagelager: () => ({
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://x/y" }, error: null })),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sparaUtkastfalten } from "@/app/kostnad/nytt/actions";
import ExportSida from "@/app/export/page";
import KvittolistaSida from "@/app/kostnad/page";
import { arUtkast, arssummaForBostad, troskelUppnadd } from "@/doman/berakningar";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";

const ANNA = "a0000000-0000-4000-8000-000000000091";
const X = "b0000000-0000-4000-8000-000000000091";
const P = "c0000000-0000-4000-8000-000000000091";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const TROSKEL = REGELPARAMETRAR.find((r) => r.nyckel === "troskelbelopp")!.varde;

let utkastId = "";
const ANTECKNINGEN = "Altanbygget, andra fakturan: snickeriet och virket till trappan";

async function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Altanen", ar: 2026, atgardstyp: "nybyggnad" });
  // Ett sparat kvitto under troskeln for 2026: 4 000 kr.
  const k = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Bauhaus", totalbelopp: 400_000,
    dokumentdatum: datum("2026-03-01"), betaldatum: datum("2026-03-01"), skapad_av: ANNA,
  });
  const kr = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Virke", belopp: 400_000 });
  db.lagg("radfordelning", { kostnadsrad_id: kr.id, projekt_id: P, andel: 1 });

  // Utkastet: skapat nar filen valdes, med sin bilaga.
  const u = db.lagg("kostnad", { bostad_id: X, skapad_av: ANNA });
  utkastId = u.id as string;
  db.lagg("bilaga", {
    kostnad_id: u.id, lagringsnyckel: `${X}/${u.id}/a.jpg`, filnamn: "kvitto.jpg", mimetyp: "image/jpeg",
    storlek: 120_000, uppladdning_bekraftad: true, dokument_analyserad: true,
  });
  const ur = db.lagg("kostnadsrad", { kostnad_id: u.id, artikel: "Byggfirman", belopp: 6_081_250 });
  db.lagg("radfordelning", { kostnadsrad_id: ur.id, projekt_id: P, andel: 1 });

  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
  // Det hon skrev, genom den riktiga vagen.
  const r = await sparaUtkastfalten(utkastId, {
    belopp: "60 812,50", datum: "2026-10-01", leverantor: "Byggfirman AB", rot: "11 587,50",
    anteckning: ANTECKNINGEN,
  });
  expect(r, "forutsattningen: utkastets falt sparades").toEqual({ ok: true });
}

const utkastet = () => h.db.tabell("kostnad").find((k) => k.id === utkastId)!;

async function kvittoraden(): Promise<HTMLAnchorElement | undefined> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup(await KvittolistaSida());
  return [...div.querySelectorAll("a")].find((a) => (a.getAttribute("href") ?? "").includes(utkastId));
}

async function arssumman2026() {
  const data = await hamtaBostadsdata(X);
  const summa = arssummaForBostad({ kostnader: data.kostnader, projekt: data.projekt }, 2026);
  const domanUtkast = data.kostnader.find((k) => k.id === utkastId);
  return { summa, troskel: troskelUppnadd(summa, TROSKEL), arUtkast: domanUtkast ? arUtkast(domanUtkast) : null };
}

async function underlaget(): Promise<string> {
  return renderToStaticMarkup((await ExportSida()) as ReactElement);
}

beforeEach(async () => {
  await seeda();
});

describe("ett utkast med sparade falt ar fortfarande ett utkast", () => {
  it("forutsattningen: beloppet ligger i utkast_belopp, inte i totalbelopp", () => {
    expect(utkastet()).toMatchObject({
      totalbelopp: null, utkast_belopp: 6_081_250, leverantor: "Byggfirman AB", rot_utnyttjat: 1_158_750,
      anteckning: ANTECKNINGEN,
    });
  });

  it("kvittolistan: utkastraden, med anteckningen, utan belopp och utan ROT-rad", async () => {
    const rad = await kvittoraden();
    expect(rad?.getAttribute("href")).toBe(`/kostnad/nytt?utkast=${utkastId}`);
    const text = (rad?.textContent ?? "").replace(/\s/g, " ");
    expect(text).toContain(ANTECKNINGEN);
    expect(text).toContain("Utkast · komplettera uppgifterna");
    expect(text).not.toContain("60 812");
    expect(text).not.toContain("11 587");
    expect(text).not.toMatch(/ROT/);
  });

  it("kvittolistan: utan anteckning visar utkastraden leverantoren", async () => {
    await sparaUtkastfalten(utkastId, {
      belopp: "60 812,50", datum: "2026-10-01", leverantor: "Byggfirman AB", rot: "11 587,50", anteckning: "",
    });
    const text = ((await kvittoraden())?.textContent ?? "").replace(/\s/g, " ");
    expect(text).toContain("Byggfirman AB");
    expect(text).toContain("Utkast · komplettera uppgifterna");
  });

  it("kvittolistan: utkastet ligger under 2026, raknas i antalet men inte i summan", async () => {
    const div = document.createElement("div");
    div.innerHTML = renderToStaticMarkup(await KvittolistaSida());
    const rubriker = [...div.querySelectorAll("summary")].map((r) => (r.textContent ?? "").replace(/\s/g, " "));
    expect(rubriker.some((r) => r.startsWith("Utan betaldatum")), "utkastet under Utan betaldatum").toBe(false);
    const ar2026 = rubriker.find((r) => r.startsWith("2026"));
    // Bauhaus 4 000 kr och utkastet: tva kvitton, ett belopp.
    expect(ar2026).toBe("2026 · 2 kvitton4 000 kr");
  });

  it("arssumman och troskeln: utkastet raknas inte – 4 000 kr, under troskeln", async () => {
    expect(await arssumman2026()).toEqual({ summa: 400_000, troskel: false, arUtkast: true });
  });

  it("underlagets Återstår: Saknar belopp, med vagen till utkastet, och inget av hennes tal", async () => {
    const html = (await underlaget()).replace(/\s/g, " ");
    expect(html).toContain("Saknar belopp");
    expect(html).toContain(`/kostnad/nytt?utkast=${utkastId}`);
    expect(html).not.toContain("60 812");
  });
});

describe("motprovet: samma rad med beloppet i totalbelopp ar ett kvitto", () => {
  beforeEach(() => {
    utkastet().totalbelopp = utkastet().utkast_belopp;
  });

  it("kvittolistan: arsrubriken raknar med beloppet", async () => {
    const div = document.createElement("div");
    div.innerHTML = renderToStaticMarkup(await KvittolistaSida());
    const ar2026 = [...div.querySelectorAll("summary")]
      .map((r) => (r.textContent ?? "").replace(/\s/g, " "))
      .find((r) => r.startsWith("2026"));
    // 4 000 kr plus 60 812,50 kr minus ROT 11 587,50 kr, avrundat i rubriken.
    expect(ar2026).toBe("2026 · 2 kvitton53 225 kr");
  });

  it("kvittolistan: en vanlig kvittorad", async () => {
    const rad = await kvittoraden();
    expect(rad?.getAttribute("href")).toBe(`/kostnad/${utkastId}`);
    expect(rad?.textContent ?? "").not.toContain("Utkast · komplettera uppgifterna");
  });

  it("arssumman och troskeln: 53 225 kr, over troskeln", async () => {
    // Bauhaus 4 000 kr plus utkastets 60 812,50 kr med sitt ROT-avdrag
    // 11 587,50 kr dragen – steg 1 i berakningen.
    expect(await arssumman2026()).toEqual({ summa: 400_000 + 6_081_250 - 1_158_750, troskel: true, arUtkast: false });
  });

  it("underlagets Återstår: inte Saknar belopp", async () => {
    const html = await underlaget();
    expect(html).not.toContain(`/kostnad/nytt?utkast=${utkastId}`);
  });
});
