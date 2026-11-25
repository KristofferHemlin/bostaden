// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Ett kvitto som ingår i basen men inte i avdraget säger det på sin rad, och
// projektets summa säger hur mycket av den som inte räknas (docs/design.md,
// samma rubrik). Talen är orörda: summan är fortfarande projektSumma, och
// merkostnaden fördelas på hela projektet (CLAUDE.md, "Kostnader som faller
// bort senare får ändå sin del").
//
// Fallet är det uppmätta i produktionen 2026-11-25: två kvitton, det ena
// före tillträdet. 50 287,50 kr med 6 480 kr ROT och 12 000 kr – summan
// 55 807,50 kr, varav 43 807,50 kr före tillträdet. Kvittot före tillträdet
// är exemplet i design.md, med samma anteckning, leverantör och datum, så att
// raden kan jämföras med exemplet rad för rad. Lydelserna läses ur design.md
// inne i provet.
//
// Och ett obetalt kvitto före tillträdet säger samma sak och inte "Obetald"
// (docs/design.md, "Obetald lovar något den inte kan hålla"): tillträdet
// avgör först. Innanför tillträdet står "Obetald" kvar, eftersom det då är sant.
//
// Renderat på båda skärmarna med raden: projektsidan och Kvittona.

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
  usePathname: () => "/projekt",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
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
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({}),
}));

import { renderToStaticMarkup } from "react-dom/server";
import ProjektSida from "@/app/projekt/[id]/page";
import KvittonaSida from "@/app/projekt/[id]/kvitton/andra/page";
import { projektetsBelopp } from "@/doman/atgardsberakning";
import { projektSumma } from "@/doman/berakningar";
import { tillDomanKostnad } from "@/lib/doman-fran-db";

const ANNA = "a0000000-0000-4000-8000-0000000000f4";
const X = "b0000000-0000-4000-8000-0000000000f4";
const P = "c0000000-0000-4000-8000-0000000000f4";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const kr = (t: string) => t.replace(/ /g, " ");

interface Kvitto {
  namn: string;
  leverantor?: string;
  belopp: number;
  rot?: number;
  dag: string | null;
  betald?: boolean;
  utkast?: boolean;
  arkiverad?: boolean;
}

function seeda(kvitton: Kvitto[]) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "bostadsratt", tilltradesdatum: datum("2026-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Nytt badrum", ar: 2026, atgardstyp: "utbytt", battre_kvalitet: true,
    merkostnad: 2_000_000, merkostnad_bas: 6_228_750, skick_forvarv: 1,
  });
  for (const k of kvitton) {
    const rad = db.lagg("kostnad", {
      bostad_id: X, leverantor: k.leverantor ?? "Byggfirman", anteckning: k.namn,
      totalbelopp: k.utkast ? null : k.belopp, rot_utnyttjat: k.rot ?? 0,
      dokumentdatum: k.dag ? datum(k.dag) : null,
      betaldatum: k.dag && k.betald !== false && !k.utkast ? datum(k.dag) : null,
      arkiverad: k.arkiverad ?? false,
    });
    const r = db.lagg("kostnadsrad", { kostnad_id: rad.id, artikel: k.namn, belopp: k.belopp });
    db.lagg("radfordelning", { kostnadsrad_id: r.id, projekt_id: P, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

const FORE: Kvitto = {
  namn: "nytt klinkergolv i badrummet, det gamla var sprucket sedan vi flyttade in",
  leverantor: "SNICKERI NORD AB",
  belopp: 5_028_750,
  rot: 648_000,
  dag: "2026-03-14",
};
const EFTER: Kvitto = { namn: "Blandare", belopp: 1_200_000, dag: "2026-09-01" };

/** Citaten under en rubrik i design.md, som grupper av på varandra följande
 *  citatrader, utan markeringar. Stannar när rubriken eller citaten saknas. */
function citatgrupper(rubrik: string): string[][] {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const start = design.indexOf(rubrik);
  if (start < 0) throw new Error(`design.md saknar "${rubrik}"`);
  const slut = design.indexOf("\n#### ", start + rubrik.length);
  const avsnitt = design.slice(start, slut < 0 ? undefined : slut);
  const grupper = [...avsnitt.matchAll(/((?:^>.*\n?)+)/gm)].map((g) =>
    g[1].split("\n").filter((r) => r.startsWith(">")).map((r) => r.replace(/^> ?/, "").trim()),
  );
  if (grupper.length === 0) throw new Error(`design.md har inga citat under "${rubrik}"`);
  return grupper;
}
const utan = (t: string) => t.replace(/\*\*/g, "").replace(/\*/g, "").trim();

/** Exempelraden, tillståndet ur den (raden som är helt i fetstil) och summan. */
function citaten(): { exempel: string[]; rad: string; radKalla: string; summa: string; summaKalla: string } {
  const [exempel, summa] = citatgrupper("#### Ett kvitto som ingår i basen men inte i avdraget säger det på sin rad");
  if (!exempel || !summa) throw new Error("design.md saknar exempelraden eller summans citat under avsnittet");
  const rad = exempel.find((r) => /^\*\*[^*]+\*\*$/.test(r));
  if (!rad) throw new Error("exempelraden i design.md saknar tillståndet i fetstil");
  // summa: som kr() läser sidan, alla mellanslag vanliga. summaKalla: med
  // designens &nbsp; som det hårda mellanslag det står för.
  const kalla = utan(summa[0]);
  if (!kalla.includes("&nbsp;")) throw new Error("summans citat i design.md saknar sitt &nbsp;");
  return {
    // Som summan: rad och exempel som kr() läser sidan, radKalla med designens
    // &nbsp; som hårt mellanslag.
    exempel: exempel.map((r) => utan(r.replace(/\(dämpat\)/, "")).replace(/&nbsp;/g, " ")),
    rad: utan(rad).replace(/&nbsp;/g, " "),
    radKalla: utan(rad).replace(/&nbsp;/g, "\u00a0"),
    summa: kalla.replace(/&nbsp;/g, " "),
    summaKalla: kalla.replace(/&nbsp;/g, "\u00a0"),
  };
}

async function sida(vilken: "projekt" | "kvittona"): Promise<HTMLDivElement> {
  const params = Promise.resolve({ id: P });
  const el = vilken === "projekt" ? await ProjektSida({ params }) : await KvittonaSida({ params });
  const d = document.createElement("div");
  d.innerHTML = renderToStaticMarkup(el as Parameters<typeof renderToStaticMarkup>[0]);
  return d;
}

/** Kvittoraden med namnet: dess hela text och om beloppet är dämpat (läst på klassen). */
function raden(d: HTMLElement, namn: string): { text: string; dampad: boolean } {
  const lank = [...d.querySelectorAll("a")].find((a) => a.textContent?.includes(namn));
  if (!lank) throw new Error(`kvittoraden "${namn}" finns inte`);
  const belopp = [...lank.querySelectorAll(".font-rubrik.tabular-nums")].at(-1);
  if (!belopp) throw new Error(`kvittoraden "${namn}" har inget belopp`);
  return { text: kr(lank.textContent ?? ""), dampad: belopp.classList.contains("text-text-sekundar") };
}

const summan = (d: HTMLElement) => {
  const s = d.querySelector("[data-projektsumma]");
  if (!s) throw new Error("projektets summa finns inte");
  return kr(s.textContent ?? "");
};

describe.each(["projekt", "kvittona"] as const)("%s: ett kvitto före tillträdet", (vilken) => {
  it("raden bär tillståndet, med leverantör och datum kvar och beloppet dämpat", async () => {
    seeda([FORE, EFTER]);
    const r = raden(await sida(vilken), FORE.namn);
    expect(r.text).toContain(citaten().rad);
    expect(r.text, "datumet som skälet handlar om står kvar").toContain("2026-03-14");
    expect(r.dampad).toBe(true);
  });

  it("raden är exemplet i design.md, rad för rad och i den ordningen", async () => {
    seeda([FORE, EFTER]);
    const { text } = raden(await sida(vilken), FORE.namn);
    let fran = 0;
    for (const rad of citaten().exempel) {
      const plats = text.indexOf(rad, fran);
      expect(plats, `"${rad}" efter det föregående i raden`).toBeGreaterThanOrEqual(0);
      fran = plats + rad.length;
    }
  });

  it("kvittot efter tillträdet har ingen sådan rad och ett odämpat belopp", async () => {
    seeda([FORE, EFTER]);
    const r = raden(await sida(vilken), EFTER.namn);
    expect(r.text).not.toContain("räknas inte i underlaget");
    expect(r.dampad).toBe(false);
  });

  it("summan säger vad den innehåller, ordagrant designens", async () => {
    seeda([FORE, EFTER]);
    expect(summan(await sida(vilken))).toBe(citaten().summa);
  });

  it("tillståndsradens hårda mellanslag sitter där designen sätter dem, och bara där", async () => {
    seeda([FORE, EFTER]);
    const d = await sida(vilken);
    const { rad, radKalla } = citaten();
    if (!radKalla.includes("\u00a0")) throw new Error("tillståndsraden i design.md saknar sitt &nbsp;");
    const p = [...d.querySelectorAll("p")].find((e) => kr(e.textContent ?? "") === rad);
    if (!p) throw new Error(`ingen rad med texten "${rad}"`);
    const ra = p.textContent ?? "";
    expect(ra.length, "samma längd som designens rad").toBe(radKalla.length);
    for (let i = 0; i < radKalla.length; i++) {
      const c = radKalla[i];
      if (c !== " " && c !== "\u00a0") continue;
      const vantat = c === "\u00a0" ? "hårt" : "brytbart";
      const faktiskt = ra[i] === "\u00a0" ? "hårt" : ra[i] === " " ? "brytbart" : `"${ra[i]}"`;
      expect(faktiskt, `mellanslaget efter "${radKalla.slice(0, i)}"`).toBe(vantat);
    }
  });

  it("summans hårda mellanslag sitter där designen sätter dem, och bara där", async () => {
    seeda([FORE, EFTER]);
    const s = (await sida(vilken)).querySelector("[data-projektsumma]");
    if (!s) throw new Error("projektets summa finns inte");
    const ra = s.textContent ?? "";
    const { summaKalla } = citaten();
    expect(kr(ra)).toBe(kr(summaKalla));
    // Ett mellanslag inne i ett belopp ("43 807,50", "50 kr") hör till beloppet
    // och är hårt i formateraKronor; det prövas inte här. Varje annat
    // mellanslag ska vara det designen skriver: &nbsp; hårt, resten brytbart.
    const iBelopp = (i: number) => /\d/.test(summaKalla[i - 1] ?? "") && /[\dk]/.test(summaKalla[i + 1] ?? "");
    let harda = 0;
    for (let i = 0; i < summaKalla.length; i++) {
      const c = summaKalla[i];
      if (c !== " " && c !== "\u00a0") continue;
      if (iBelopp(i)) continue;
      const vantat = c === "\u00a0" ? "hårt" : "brytbart";
      const faktiskt = ra[i] === "\u00a0" ? "hårt" : ra[i] === " " ? "brytbart" : `"${ra[i]}"`;
      expect(faktiskt, `mellanslaget efter "${summaKalla.slice(0, i)}"`).toBe(vantat);
      if (c === "\u00a0") harda++;
    }
    // Antalet ur designens citat, inte en konstant: positionsprovet ovan
    // fäller ett hårt mellanslag för mycket eller för lite, var det än sitter.
    expect(harda, "förutsättningen: designens citat har hårda mellanslag utanför beloppen").toBeGreaterThan(0);
  });

  it("utan kvitto före tillträdet: summan står ensam, och ingen rad bär tillståndet", async () => {
    seeda([EFTER, { ...EFTER, namn: "Kakel", dag: "2026-10-01" }]);
    const d = await sida(vilken);
    expect(summan(d)).toMatch(/^[\d ]+,?\d* kr$/);
    expect(kr(d.textContent ?? "")).not.toContain("räknas inte i underlaget");
  });
});

// Skälen som redan håller kvittot utanför projektetsBelopp kom aldrig in i
// basen, och raden gäller inte dem (docs/design.md: "rör inte den här
// raden"). Förutsättningen prövas: kvittot är daterat före tillträdet.
describe("inte för det som har ett eget tillstånd", () => {
  it("ett utkast före tillträdet får ingen rad, och summan inget varav", async () => {
    const kvitto = { ...FORE, namn: "Fotat kvitto", utkast: true };
    seeda([kvitto, EFTER]);
    const d = await sida("projekt");
    expect(raden(d, kvitto.namn).text).not.toContain("räknas inte i underlaget");
    expect(summan(d)).not.toContain("varav");
  });

  it("ett arkiverat kvitto före tillträdet syns inte i projektets summa, och ger inget varav", async () => {
    seeda([{ ...FORE, namn: "Hörde inte hit", arkiverad: true }, EFTER]);
    expect(summan(await sida("projekt"))).not.toContain("varav");
  });
});

describe("inga tal ändras", () => {
  it("summan är projektSumma och spärrens tal projektetsBelopp, kvittot före tillträdet inräknat i båda", async () => {
    seeda([FORE, EFTER]);
    const kostnader = ((await h.db.klient.kostnad.findMany({
      where: { bostad_id: X }, include: { rader: { include: { fordelningar: true } } },
    })) as never[]).map(tillDomanKostnad);
    expect(projektSumma(kostnader, P)).toBe(5_580_750);
    expect(projektetsBelopp(kostnader, P)).toBe(6_228_750);
    expect(summan(await sida("projekt")).startsWith("55 807,50 kr")).toBe(true);
  });
});

describe("Obetald lovar något den inte kan hålla", () => {
  const OBETALD = "Obetald – räknas i underlaget när den är betald";
  const tillstandet = () => {
    const [[rad]] = citatgrupper("#### Obetald lovar något den inte kan hålla");
    return utan(rad).replace(/&nbsp;/g, " ");
  };

  it("förutsättningen: avsnittets rad är samma rad som för det betalda kvittot", () => {
    expect(tillstandet()).toBe(citaten().rad);
  });

  it.each(["projekt", "kvittona"] as const)("%s: obetalt och före tillträdet – tillträdet avgör, och Obetald står inte där", async (vilken) => {
    const kvitto = { ...FORE, namn: "Obetald faktura", betald: false };
    seeda([kvitto, EFTER]);
    const r = raden(await sida(vilken), kvitto.namn);
    expect(r.text).toContain(tillstandet());
    expect(r.text).not.toContain(OBETALD);
    expect(r.dampad).toBe(true);
  });

  it("obetalt innanför tillträdet: Obetald står kvar, för där är den sann", async () => {
    const kvitto = { ...EFTER, namn: "Obetald faktura", betald: false };
    seeda([kvitto, FORE]);
    const r = raden(await sida("projekt"), kvitto.namn);
    expect(r.text).toContain(OBETALD);
    expect(r.text).not.toContain("räknas inte i underlaget");
    expect(r.dampad).toBe(false);
  });

  it("det obetalda kvittot före tillträdet är med i projektSumma och därför i varav", async () => {
    seeda([{ ...FORE, namn: "Obetald faktura", betald: false }, EFTER]);
    expect(summan(await sida("projekt"))).toBe(citaten().summa);
  });
});

// Ett arkiverat kvitto som fortfarande är kopplat till projektet (docs/design.md,
// "Ett arkiverat kvitto i ett projekt säger ingenting om att det är arkiverat").
// Markeringen lossar kopplingen i appen, så läget finns bara i äldre rader och
// i databasen – men projektsidan och Kvittona visar då raden.
//
// Ordningen prövas par för par: varje fall har bara de två tillstånd paret
// gäller, så att en omkastad ordning fäller det fall som heter som paret.
describe("Hör inte till bostaden, i ett projekt", () => {
  const OBETALD = "Obetald – räknas i underlaget när den är betald";
  /** Tillståndstexten för ett arkiverat kvitto, ur design.md. */
  const horInte = () => {
    const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
    const m = design.match(/Raden ska i stället bära leverantör och datum som varje annan rad, tillståndstexten \*([^*]+)\*/);
    if (!m) throw new Error('design.md saknar "tillståndstexten *…*" för ett arkiverat kvitto');
    return m[1];
  };
  const tilltradesraden = () => citaten().rad;

  it.each(["projekt", "kvittona"] as const)("%s: arkiverat slår obetald", async (vilken) => {
    const kvitto: Kvitto = { ...EFTER, namn: "Arkiverad obetald", rot: 300_000, betald: false, arkiverad: true };
    seeda([kvitto, EFTER]);
    const r = raden(await sida(vilken), kvitto.namn);
    expect(r.text).toContain(horInte());
    expect(r.text).not.toContain(OBETALD);
    expect(r.dampad).toBe(true);
    expect(r.text, "ingen ROT-rad: ingenting räknas").not.toContain("avgår");
  });

  it.each(["projekt", "kvittona"] as const)("%s: arkiverat slår tillträdet", async (vilken) => {
    const kvitto: Kvitto = { ...FORE, namn: "Arkiverad före tillträdet", arkiverad: true };
    seeda([kvitto, EFTER]);
    const r = raden(await sida(vilken), kvitto.namn);
    expect(r.text).toContain(horInte());
    expect(r.text, "ligger utanför basen, så tillträdesraden vore osann").not.toContain(tilltradesraden());
    expect(r.dampad).toBe(true);
    expect(r.text, "ingen ROT-rad: ingenting räknas").not.toContain("avgår");
  });

  it("förutsättningen: utan markeringen bär samma kvitton de andra tillstånden", async () => {
    seeda([{ ...EFTER, namn: "Obetald", betald: false }, { ...FORE, namn: "Före" }]);
    const d = await sida("projekt");
    expect(raden(d, "Obetald").text).toContain(OBETALD);
    expect(raden(d, "Före").text).toContain(tilltradesraden());
    expect(raden(d, "Före").text).toContain("avgår");
    expect(raden(d, "Obetald").text).not.toContain(horInte());
  });

  it("det arkiverade kvittot rör inte summan", async () => {
    seeda([{ ...EFTER, namn: "Arkiverad", arkiverad: true }, EFTER]);
    expect(summan(await sida("projekt"))).toBe(kr("12 000 kr"));
  });
});
