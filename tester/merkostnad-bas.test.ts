import { beforeEach, describe, expect, it, vi } from "vitest";

// Backfillen av merkostnad_bas (CLAUDE.md, steg 2: "Känd lucka med ett
// utgångsdatum"). Svar fran innan kolumnen fanns saknar jamforelsetal, och for
// dem upptacks ingen andring av projektet. Jobbet ger dem projektets
// nuvarande belopp – och efter det flaggas en andring som for alla andra.
//
// Ingen riktig databas: CLAUDE.md forbjuder att lamna produktionens adress
// till ett verktyg som behover en databas att arbeta i, och nagon tom
// testdatabas finns inte. Prisma ar ersatt av en attrapp med samma fragor.

const h = vi.hoisted(() => ({
  projektFindMany: vi.fn(),
  projektUpdateMany: vi.fn(),
  kostnadFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projekt: { findMany: h.projektFindMany, updateMany: h.projektUpdateMany },
    kostnad: { findMany: h.kostnadFindMany },
  },
}));

import { merkostnadBehoverBekraftas, projektetsBelopp } from "@/doman/atgardsberakning";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { fyllPaMerkostnadBas, merkostnadBasAttFyllaPa } from "@/lib/merkostnad-bas";

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const PROJEKT = "33333333-3333-3333-3333-333333333333";

/** En kostnad som databasen lamnar den, kopplad helt till projektet. */
function kostnadsrad(id: string, belopp: number) {
  return {
    id,
    bostad_id: BOSTAD,
    totalbelopp: belopp,
    betaldatum: new Date("2023-03-01T00:00:00.000Z"),
    dokumentdatum: new Date("2023-03-01T00:00:00.000Z"),
    rot_utnyttjat: null,
    forsakringsersattning: null,
    arkiverad: false,
    rader: [
      {
        id: `${id}-r`,
        kostnad_id: id,
        artikel: "Fönster",
        belopp,
        fordelningar: [
          { id: `${id}-f`, kostnadsrad_id: `${id}-r`, projekt_id: PROJEKT, privat: false, andel: 1 },
        ],
      },
    ],
  };
}

// Ett gammalt svar: merkostnad 12 000 kr, inget jamforelsetal. Projektet ar
// 50 000 kr i dag.
const GAMMALT = {
  id: PROJEKT,
  namn: "Bytte fönster",
  bostad_id: BOSTAD,
  merkostnad: 1_200_000,
  merkostnad_bas: null,
};
const IDAG = [kostnadsrad("a", 3_000_000), kostnadsrad("b", 2_000_000)];

/** Attrappens rad som domanens kostnad. andel ar ett tal har dar Prisma ger
 *  en Decimal – tillDomanKostnad gor Number() av den i bada fallen. */
const doman = (k: ReturnType<typeof kostnadsrad>) =>
  tillDomanKostnad(k as unknown as Parameters<typeof tillDomanKostnad>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  h.projektFindMany.mockResolvedValue([GAMMALT]);
  h.kostnadFindMany.mockResolvedValue(IDAG);
  h.projektUpdateMany.mockResolvedValue({ count: 1 });
});

describe("backfillen av merkostnad_bas", () => {
  it("torrt läge listar projektet med dagens belopp och skriver ingenting", async () => {
    const r = await fyllPaMerkostnadBas({ skarpt: false });
    expect(r.rader.map(({ id, bas }) => ({ id, bas }))).toEqual([
      { id: PROJEKT, bas: 5_000_000 },
    ]);
    expect(r.skrivna).toBe(0);
    expect(h.projektUpdateMany).not.toHaveBeenCalled();
  });

  it("skarpt läge skriver exakt det projektet, och bara om jämförelsetalet fortfarande saknas", async () => {
    const r = await fyllPaMerkostnadBas({ skarpt: true });
    expect(r.skrivna).toBe(1);
    expect(h.projektUpdateMany).toHaveBeenCalledOnce();
    expect(h.projektUpdateMany).toHaveBeenCalledWith({
      where: { id: PROJEKT, merkostnad_bas: null, merkostnad: { not: null } },
      data: { merkostnad_bas: 5_000_000 },
    });
  });

  it("ett projekt som redan har ett jämförelsetal rörs inte", () => {
    expect(
      merkostnadBasAttFyllaPa(
        [{ id: PROJEKT, merkostnad: 1_200_000, merkostnad_bas: 4_000_000 }],
        IDAG.map(doman),
      ),
    ).toEqual([]);
  });

  it("ett projekt utan merkostnad rörs inte", () => {
    expect(
      merkostnadBasAttFyllaPa(
        [{ id: PROJEKT, merkostnad: null, merkostnad_bas: null }],
        IDAG.map(doman),
      ),
    ).toEqual([]);
  });

  it("efter backfillen flaggas en ändring av projektet – det gjorde den inte förut", async () => {
    const projekt = {
      atgardstyp: "utbytt" as const,
      battre_kvalitet: true,
      merkostnad: 1_200_000,
    };
    // Fore: inget jamforelsetal, och ett kvitto flyttas ut – ingen flagga.
    const efterUtflytt = [kostnadsrad("a", 3_000_000)].map(doman);
    const belopp = projektetsBelopp(efterUtflytt, PROJEKT);
    expect(merkostnadBehoverBekraftas({ ...projekt, merkostnad_bas: null }, belopp)).toBeNull();

    // Backfillen ger projektet dagens belopp, 50 000 kr...
    const { rader } = await fyllPaMerkostnadBas({ skarpt: true });
    const bas = rader[0].bas;
    expect(bas).toBe(5_000_000);

    // ...och nar ett kvitto sedan flyttas ut flaggas det.
    expect(merkostnadBehoverBekraftas({ ...projekt, merkostnad_bas: bas }, belopp)).toBe(
      "projektet_andrat",
    );
  });
});
