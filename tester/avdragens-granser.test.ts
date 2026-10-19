import { beforeEach, describe, expect, it, vi } from "vitest";

// CLAUDE.md, steg 2, tabellen: tre tal dras fran en kostnad, och alla tre
// behover en ovre grans – men inte samma.
//
//   0 ≤ rot_utnyttjat < bas            strangt
//   0 ≤ forsakringsersattning ≤ bas    lika med tillats
//   rot + forsakring ≤ bas             summan har en egen grans
//
// `bas` ar kvittots del som hor till bostaden – totalbeloppet minus privata
// rader – eftersom det ar den steg 1 drar ROT och ersattning fran
// (fastslaget 2026-10-19). Utan gransen klams avdragsgrundande tyst till noll,
// och en hel kostnad forsvinner ur underlaget utan ett ord.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const KOSTNAD = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  kostnadFindFirst: vi.fn(),
  kostnadUpdate: vi.fn(),
  kostnadsradDeleteMany: vi.fn(),
  kostnadsradCreate: vi.fn(),
  projektFindFirst: vi.fn(),
  projektFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kostnad: { findFirst: h.kostnadFindFirst, update: h.kostnadUpdate },
    kostnadsrad: { deleteMany: h.kostnadsradDeleteMany, create: h.kostnadsradCreate },
    projekt: { findFirst: h.projektFindFirst, findMany: h.projektFindMany },
    $transaction: h.transaction,
  },
}));
vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({ bostadId: BOSTAD })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

import { delaUppKostnad, redigeraKostnad } from "@/app/kostnad/[id]/actions";
import { avdragensFel } from "@/lib/kostnadsformular";

const kr = (oren: number) => `${new Intl.NumberFormat("sv-SE").format(oren / 100)} kr`;

describe("gränserna, var för sig", () => {
  const BAS = { bas: 1_000_000, harPrivatDel: false };

  it("ROT lika med beloppet avvisas – gränsen är sträng", () => {
    expect(avdragensFel({ ...BAS, rot: 1_000_000, forsakring: 0 })?.fel).toBe(
      `Ange ett ROT-avdrag mindre än ${kr(1_000_000)} – det är vad kvittot kostade.`,
    );
  });

  it("ROT under beloppet går igenom", () => {
    expect(avdragensFel({ ...BAS, rot: 999_999, forsakring: 0 })).toBeNull();
  });

  it("försäkringsersättning lika med beloppet går igenom – försäkringen kan ha betalat allt", () => {
    expect(avdragensFel({ ...BAS, rot: 0, forsakring: 1_000_000 })).toBeNull();
  });

  it("försäkringsersättning över beloppet avvisas", () => {
    expect(avdragensFel({ ...BAS, rot: 0, forsakring: 1_000_001 })?.fel).toBe(
      `Försäkringsersättningen kan vara högst ${kr(1_000_000)} – det är vad kvittot kostade.`,
    );
  });

  it("var för sig rimliga, tillsammans för mycket: summan avvisas", () => {
    expect(avdragensFel({ ...BAS, rot: 600_000, forsakring: 500_000 })?.fel).toBe(
      `ROT-avdraget och försäkringsersättningen blir tillsammans ${kr(1_100_000)}, men kvittot kostade ${kr(1_000_000)}.`,
    );
  });

  it("med en privat del säger meddelandet det", () => {
    expect(
      avdragensFel({ bas: 400_000, harPrivatDel: true, rot: 500_000, forsakring: 0 })?.fel,
    ).toBe(
      `Ange ett ROT-avdrag mindre än ${kr(400_000)} – det är vad kvittot kostade utan den privata delen.`,
    );
  });
});

/** 10 000 kr, varav 6 000 kr privat, med en sparad forsakringsersattning. */
function kvittoMedPrivatDel(forsakring: number) {
  return {
    id: KOSTNAD,
    bostad_id: BOSTAD,
    leverantor: "Hantverkarn AB",
    totalbelopp: 1_000_000,
    betaldatum: new Date("2026-05-01T00:00:00.000Z"),
    dokumentdatum: new Date("2026-05-01T00:00:00.000Z"),
    anteckning: null,
    rot_utnyttjat: null,
    forsakringsersattning: forsakring,
    arkiverad: false,
    rader: [
      { id: "r1", artikel: "Privat", belopp: 600_000, fordelningar: [{ projekt_id: null, privat: true, andel: 1 }] },
      { id: "r2", artikel: "Hantverkarn AB", belopp: 400_000, fordelningar: [] },
    ],
  };
}

function formular(varden: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    kostnad_id: KOSTNAD,
    leverantor: "Hantverkarn AB",
    totalbelopp: "10 000",
    dokumentdatum: "2026-05-01",
    betaldatum: "2026-05-01",
    projekt_id: "",
    anteckning: "",
    privatbelopp: "6 000",
    ...varden,
  })) {
    f.set(k, v);
  }
  return f;
}

/** Steg 1 ur det som sparades: bostadens del minus ROT minus ersattning –
 *  UTAN den nollklamning domanen gor, sa att ett negativt tal syns. */
function sparatAvdragsgrundande(forsakring: number): number | null {
  if (h.kostnadUpdate.mock.calls.length === 0) return null;
  const data = h.kostnadUpdate.mock.calls[0][0].data;
  const rader = h.kostnadsradCreate.mock.calls.map(([a]) => a.data);
  const bas = rader
    .filter((r) => !(r.fordelningar?.create ?? []).some((f: { privat: boolean }) => f.privat))
    .reduce((s, r) => s + r.belopp, 0);
  return bas - (data.rot_utnyttjat ?? 0) - forsakring;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.kostnadUpdate.mockImplementation(async (x) => x);
  h.kostnadsradDeleteMany.mockResolvedValue({});
  h.kostnadsradCreate.mockImplementation(async (x) => x);
  h.transaction.mockImplementation(async (ops: unknown[]) => ops);
  h.projektFindMany.mockResolvedValue([]);
});

describe("ändringsläget: basen är kvittots del som hör till bostaden", () => {
  it("ROT 5 000 kr på 10 000 kr varav 6 000 privat avvisas – bostadens del är 4 000 kr", async () => {
    h.kostnadFindFirst.mockResolvedValue(kvittoMedPrivatDel(0));
    const r = await redigeraKostnad({}, formular({ rot_utnyttjat: "5 000" }));
    expect(r.fel).toBe(
      `Ange ett ROT-avdrag mindre än ${kr(400_000)} – det är vad kvittot kostade utan den privata delen.`,
    );
    // Meningen hor till ROT-faltet och visas dar (docs/design.md).
    expect(r.falt).toBe("rot_utnyttjat");
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("summan: ROT 2 000 kr och en sparad ersättning på 3 000 kr mot 4 000 kr ger aldrig ett negativt underlag", async () => {
    h.kostnadFindFirst.mockResolvedValue(kvittoMedPrivatDel(300_000));
    const r = await redigeraKostnad({}, formular({ rot_utnyttjat: "2 000" }));
    // Pa talet: ingenting som sparas far ge ett negativt avdragsgrundande.
    const sparat = sparatAvdragsgrundande(300_000);
    if (sparat !== null) expect(sparat).toBeGreaterThanOrEqual(0);
    expect(r.fel).toBe(
      `ROT-avdraget och försäkringsersättningen blir tillsammans ${kr(500_000)}, men kvittot kostade ${kr(400_000)} utan den privata delen.`,
    );
  });

  it("ROT 3 000 kr mot bostadens 4 000 kr går igenom", async () => {
    h.kostnadFindFirst.mockResolvedValue(kvittoMedPrivatDel(0));
    const r = await redigeraKostnad({}, formular({ rot_utnyttjat: "3 000" }));
    expect(r.fel).toBeUndefined();
    expect(sparatAvdragsgrundande(0)).toBe(100_000);
  });
});

describe("dela upp kvittot: en ny privat rad får inte krympa bostadens del under ROT", () => {
  it("ROT 5 000 kr, och 6 000 av 10 000 markeras privat – avvisas", async () => {
    h.kostnadFindFirst.mockResolvedValue({
      id: KOSTNAD,
      totalbelopp: 1_000_000,
      rot_utnyttjat: 500_000,
      forsakringsersattning: 0,
    });
    const f = new FormData();
    f.set("kostnad_id", KOSTNAD);
    for (const [artikel, belopp, mal] of [
      ["Privat", "6 000", "privat"],
      ["Arbete", "4 000", ""],
    ]) {
      f.append("artikel", artikel);
      f.append("belopp", belopp);
      f.append("mal", mal);
      f.append("andel", "");
    }
    const r = await delaUppKostnad({}, f);
    expect(r.fel).toBe(
      `Ange ett ROT-avdrag mindre än ${kr(400_000)} – det är vad kvittot kostade utan den privata delen.`,
    );
    expect(h.transaction).not.toHaveBeenCalled();
  });
});
