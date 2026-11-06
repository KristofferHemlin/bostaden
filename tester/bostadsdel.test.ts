import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Bostadsdelen (docs/design.md, "Vilken del av bostaden projektet rörde";
// docs/produktspec.md, "Projektets bostadsdel"). Provat pa det som sparas och
// det som renderas:
//
//   1. Koderna ar specens, etiketterna och knapparna per upplatelseform ar
//      design.md:s – lasta ur filerna inne i testet.
//   2. Fragan ar frivillig: en hog utan svar klassificeras som forut och far
//      inga rader.
//   3. Fritext lagras aldrig som del, bara bredvid ANNAT.
//   4. Varje kod ar lagringsbar oavsett upplatelseform.
//   5. Visades fragan inte rors raderna inte – inga rader ar "inte tillfrågad".
//   6. Svaret syns som en rad pa projektets sida, och inte nar det saknas.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return { db: skapaFalskDatabas(), Omdirigering, bostadId: "", anvandareId: "" };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({ anvandareId: h.anvandareId, bostadId: h.bostadId, agarandel: 100 })),
  antalMedlemmar: vi.fn(async () => 1),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/",
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { klassificeraHog } from "@/app/genomgang/fragor/actions";
import { redigeraProjekt } from "@/app/projekt/actions";
import ProjektSida from "@/app/projekt/[id]/page";
import {
  BOSTADSDEL_ETIKETT,
  BOSTADSDELAR,
  bostadsdelarFor,
  tolkaBostadsdelar,
} from "@/doman/bostadsdel";

const las = (fil: string) => readFileSync(join(process.cwd(), "docs", fil), "utf-8");

/** Knapparna per upplatelseform, ur tabellen i design.md. */
function knapparIDesign(): { bostadsratt: string[]; fastighetPlus: string[] } {
  const d = las("design.md");
  const br = d.match(/^\| Bostadsrätt \| (.+) \|$/m);
  const fa = d.match(/^\| Fastighet \| Alla ovan, plus (.+) \|$/m);
  if (!br || !fa) throw new Error("design.md saknar knapptabellen");
  return { bostadsratt: br[1].split(", "), fastighetPlus: fa[1].split(", ") };
}

/** Koderna ur datamodellen i produktspec.md. */
function koderISpec(): string[] {
  const m = las("produktspec.md").match(/^\| del \| enum \| (.+) \|$/m);
  if (!m) throw new Error("produktspec.md saknar del-raden");
  return m[1].split(", ").map((k) => k.replace(/`/g, ""));
}

const ANNA = "a0000000-0000-4000-8000-0000000000f1";
const BOSTAD = "b0000000-0000-4000-8000-0000000000f1";
const PROJEKT = "c0000000-0000-4000-8000-0000000000f1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda(upplatelseform: "bostadsratt" | "fastighet" = "bostadsratt") {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: BOSTAD, adress: "Storgatan 1", upplatelseform, tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: BOSTAD, agarandel: 100 });
  db.lagg("projekt", { id: PROJEKT, bostad_id: BOSTAD, namn: "", ar: 2025, atgardstyp: null });
  const k = db.lagg("kostnad", {
    bostad_id: BOSTAD, leverantor: "Beijer Bygg", totalbelopp: 1_800_000,
    dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02"),
  });
  const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Kök", belopp: 1_800_000 });
  db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: PROJEKT, andel: 1 });
  h.bostadId = BOSTAD;
  h.anvandareId = ANNA;
}

/** Fas 2:s formular: namnet, fraga 2 = ja, och bostadsdelens falt. */
function svar(delar: string[] | null, fritext?: string): FormData {
  const f = new FormData();
  f.set("projekt_id", PROJEKT);
  f.set("namn", "Nytt kök");
  f.set("byggde_nytt", "ja");
  if (delar !== null) {
    f.set("bostadsdel_fragad", "1");
    for (const d of delar) f.append("bostadsdel", d);
  }
  if (fritext !== undefined) f.set("bostadsdel_fritext", fritext);
  return f;
}

async function sparat(anrop: Promise<unknown>): Promise<string> {
  try {
    await anrop;
  } catch (fel) {
    if (fel instanceof h.Omdirigering) return fel.url;
    throw fel;
  }
  throw new Error(`ingen omdirigering: ${JSON.stringify(await anrop)}`);
}

const rader = () =>
  h.db
    .tabell("projekt_bostadsdel")
    .map((r) => ({ projekt_id: r.projekt_id, del: r.del, fritext: r.fritext }));

const utanTaggar = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function projektsidan(): Promise<string> {
  return renderToStaticMarkup(
    (await ProjektSida({ params: Promise.resolve({ id: PROJEKT }) })) as ReactElement,
  );
}

beforeEach(() => seeda());

describe("koder, etiketter och knappar", () => {
  it("koderna ar exakt specens, i specens ordning", () => {
    expect([...BOSTADSDELAR]).toEqual(koderISpec());
  });

  it("en bostadsratt visar design.md:s knappar, i den ordningen", () => {
    expect(bostadsdelarFor("bostadsratt").map((d) => BOSTADSDEL_ETIKETT[d])).toEqual(
      knapparIDesign().bostadsratt,
    );
  });

  it("en fastighet visar alla en bostadsratt har, plus husets", () => {
    const { bostadsratt, fastighetPlus } = knapparIDesign();
    const fastighet = bostadsdelarFor("fastighet").map((d) => BOSTADSDEL_ETIKETT[d]);
    expect([...fastighet].sort()).toEqual([...bostadsratt, ...fastighetPlus].sort());
    // Annat sist, eftersom det oppnar fritexten.
    expect(fastighet.at(-1)).toBe("Annat");
  });

  it("varje kod har en knapp i nagon upplatelseform", () => {
    expect(new Set(bostadsdelarFor("fastighet"))).toEqual(new Set(BOSTADSDELAR));
  });
});

describe("tolkningen", () => {
  it("fritext blir aldrig en del – den ligger bredvid ANNAT", () => {
    const f = new FormData();
    f.set("bostadsdel_fragad", "1");
    f.append("bostadsdel", "KOK");
    f.append("bostadsdel", "Trappan");
    f.append("bostadsdel", "ANNAT");
    f.set("bostadsdel_fritext", "  Trappan ");
    expect(tolkaBostadsdelar(f)).toEqual([
      { del: "KOK", fritext: null },
      { del: "ANNAT", fritext: "Trappan" },
    ]);
  });

  it("fritext utan ANNAT sparas inte alls", () => {
    const f = new FormData();
    f.set("bostadsdel_fragad", "1");
    f.append("bostadsdel", "EL");
    f.set("bostadsdel_fritext", "Trappan");
    expect(tolkaBostadsdelar(f)).toEqual([{ del: "EL", fritext: null }]);
  });

  it("utan markeringen visades fragan inte: null, inte en tom lista", () => {
    const f = new FormData();
    f.append("bostadsdel", "KOK");
    expect(tolkaBostadsdelar(f)).toBeNull();
  });
});

describe("fas 2 sparar svaret", () => {
  it("flera delar och Annat med fritext", async () => {
    expect(await sparat(klassificeraHog({}, svar(["KOK", "EL", "ANNAT"], "Trappan")))).toBe(
      "/genomgang/fragor",
    );
    expect(rader()).toEqual([
      { projekt_id: PROJEKT, del: "KOK", fritext: null },
      { projekt_id: PROJEKT, del: "EL", fritext: null },
      { projekt_id: PROJEKT, del: "ANNAT", fritext: "Trappan" },
    ]);
  });

  it("varje lagrad del ar en kod, aldrig fritexten", async () => {
    await sparat(klassificeraHog({}, svar(["ANNAT"], "Garderoben i hallen")));
    for (const r of rader()) expect(BOSTADSDELAR).toContain(r.del);
    expect(rader()).toEqual([{ projekt_id: PROJEKT, del: "ANNAT", fritext: "Garderoben i hallen" }]);
  });

  it("frivillig: utan svar klassificeras hogen anda, och inga rader skapas", async () => {
    expect(await sparat(klassificeraHog({}, svar([])))).toBe("/genomgang/fragor");
    const projekt = h.db.tabell("projekt").find((p) => p.id === PROJEKT)!;
    expect(projekt.atgardstyp).toBe("nybyggnad");
    expect(projekt.namn).toBe("Nytt kök");
    expect(rader()).toEqual([]);
  });

  it("tak gar att lagra for en bostadsratt – filtret ligger i granssnittet", async () => {
    seeda("bostadsratt");
    await sparat(klassificeraHog({}, svar(["TAK"])));
    expect(rader()).toEqual([{ projekt_id: PROJEKT, del: "TAK", fritext: null }]);
  });
});

describe("redigeringen", () => {
  beforeEach(async () => {
    await sparat(klassificeraHog({}, svar(["KOK", "ANNAT"], "Trappan")));
  });

  it("ersatter svaret med det nya urvalet", async () => {
    await sparat(redigeraProjekt({}, svar(["BADRUM"])));
    expect(rader()).toEqual([{ projekt_id: PROJEKT, del: "BADRUM", fritext: null }]);
  });

  it("ror inte raderna nar fragan inte visades", async () => {
    await sparat(redigeraProjekt({}, svar(null)));
    expect(rader().map((r) => r.del)).toEqual(["KOK", "ANNAT"]);
  });
});

describe("projektets sida", () => {
  it("visar svaret som en rad, med fritexten dar Annat star", async () => {
    await sparat(klassificeraHog({}, svar(["KOK", "EL", "ANNAT"], "Trappan")));
    const rad = (await projektsidan()).match(
      /<div class="flex justify-between gap-3"><span[^>]*>Del av bostaden<\/span><span[^>]*>(.*?)<\/span><\/div>/,
    );
    expect(utanTaggar(rad![1])).toBe("Kök, El, Trappan");
  });

  it("raden finns inte nar fragan aldrig besvarats", async () => {
    await sparat(klassificeraHog({}, svar([])));
    const html = await projektsidan();
    // Forutsattningen: sidan ar renderad med sina rader.
    expect(html).toContain(">Räknas som</span>");
    expect(html).not.toContain("Del av bostaden");
  });
});
