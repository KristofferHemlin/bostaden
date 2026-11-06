import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// En utestaende inbjudan bar sin lank och sin QR-kod (docs/design.md, "Att
// bjuda in en delägare"). Inget mejl skickas, sa den som stangde fliken innan
// hon skickat lanken maste kunna hitta tillbaka till SAMMA lank och kod i
// kortet Tillgang. Har provas serverns sida: samma lank, samma kod, bara i den
// egna bostaden och bara medan inbjudan ar utestaende. Kortet sjalvt provas i
// tester/tillgang-utestaende-inbjudan-dom.test.ts.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return { db: skapaFalskDatabas(), bostadId: "" };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("@/lib/session", () => ({
  kravAnvandare: vi.fn(async () => ({ id: ANNA, epost: "anna@exempel.se" })),
  kravBostad: vi.fn(async () => ({ anvandareId: ANNA, bostadId: h.bostadId, agarandel: 100 })),
  hamtaAnvandare: vi.fn(async () => ({ id: ANNA, epost: "anna@exempel.se" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test", "x-forwarded-proto": "https" }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));

import { aterkallaInbjudanAction, skapaInbjudanAction, visaInbjudanAction } from "@/app/inbjudan/actions";

const ANNA = "a0000000-0000-4000-8000-0000000000d1";
const X = "b0000000-0000-4000-8000-0000000000d1";
const Y = "b0000000-0000-4000-8000-0000000000d2";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda() {
  h.db.nollstall();
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  for (const id of [X, Y]) {
    h.db.lagg("bostad", { id, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01") });
  }
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  h.bostadId = X;
}

function formular(falt: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(falt)) f.set(k, v);
  return f;
}

type Kod = { ok: true; lank: string; qrSvg: string; epost: string; harKonto: boolean };

async function bjudIn(): Promise<Kod> {
  const svar = await skapaInbjudanAction({}, formular({ epost: "doris@exempel.se", egen_andel: "50", inbjuden_andel: "50" }));
  if (!svar.ok) throw new Error(`inbjudan skapades inte: ${svar.fel}`);
  return svar;
}

const inbjudanId = () => h.db.tabell("inbjudan")[0]!.id as string;

beforeEach(seeda);

describe("visaInbjudanAction", () => {
  it("ger samma lank och samma QR-kod som nar inbjudan skapades", async () => {
    const ny = await bjudIn();
    const igen = await visaInbjudanAction({}, formular({ inbjudan_id: inbjudanId() }));
    expect(igen).toEqual({ ok: true, lank: ny.lank, qrSvg: ny.qrSvg, epost: "doris@exempel.se", harKonto: false });
    expect(ny.lank).toBe(`https://bostad.test/inbjudan/${inbjudanId()}`);
  });

  it("skapar ingen ny inbjudan och andrar ingenting", async () => {
    await bjudIn();
    const fore = h.db.ogonblick();
    await visaInbjudanAction({}, formular({ inbjudan_id: inbjudanId() }));
    expect(h.db.ogonblick()).toEqual(fore);
  });

  it("visar inte en annan bostads inbjudan", async () => {
    await bjudIn();
    h.bostadId = Y;
    const svar = await visaInbjudanAction({}, formular({ inbjudan_id: inbjudanId() }));
    expect(svar.ok).not.toBe(true);
    expect(JSON.stringify(svar)).not.toContain(inbjudanId());
  });

  it("visar inte en aterkallad inbjudan", async () => {
    await bjudIn();
    await aterkallaInbjudanAction({}, formular({ inbjudan_id: inbjudanId() }));
    const svar = await visaInbjudanAction({}, formular({ inbjudan_id: inbjudanId() }));
    expect(svar).toEqual({ fel: "Inbjudan är redan använd eller återkallad." });
  });
});

// design.md lases inne i testet (CLAUDE.md, Tester).
it("raden 'Väntar på svar' star i design.md med den lydelse kortet anvander", async () => {
  const { INBJUDAN_VANTAR } = await import("@/app/installningar/dela-bostaden");
  const m = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8").match(
    /bara blivit tillfrågad\. \*([^*]+)\* säger vilket/,
  );
  expect(INBJUDAN_VANTAR).toBe(m?.[1]);
});

it("knappen tillbaka till lanken heter som i design.md, i kortet och pa startskarmen", async () => {
  const { VISA_LANKEN_IGEN } = await import("@/app/installningar/dela-bostaden");
  const m = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8").match(
    /knappen tillbaka till länken heter \*\*"([^"]+)"\*\*/,
  );
  expect(VISA_LANKEN_IGEN).toBe(m?.[1]);
});
