import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression (kostnad/[id]/actions.ts, redigeraKostnad): ROT-avdraget
// jamfordes mot kostnadens SEDAN TIDIGARE SPARADE totalbelopp i stallet for
// det NYSS INSKRIVNA – en giltig sparning dar bade totalbeloppet och ROT
// hojdes i SAMMA omgang avvisades da felaktigt, sa fort det gamla sparade
// beloppet rakade vara mindre an det nya ROT-beloppet. Exemplet som
// avslojade felet: totalbelopp 344 250 kr, ROT-avdrag 75 000 kr (75 000 <
// 344 250, ska passera) – kontrollen jamforde ROT mot ett gammalt, mindre
// sparat belopp och avvisade sparningen trots att 75 000 < 344 250.
//
// Testerna anvander den RIKTIGA redigeraKostnad, med prisma/session mockat –
// samma monster som tester/installningar-kopet.test.ts. Det gamla sparade
// beloppet skickas in i ÖREN direkt (kringgar formulartolkningen helt), och
// de nya faltet skickas in som KRONSTRÄNGAR sa som ett riktigt formular gor –
// om jamforelsen nagonsin blandade enheterna eller ratt variabel skulle nagon
// av testerna nedan sla fel.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const KOSTNAD = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  kostnadFindFirst: vi.fn(),
  kostnadUpdate: vi.fn(),
  kostnadsradDeleteMany: vi.fn(),
  kostnadsradCreate: vi.fn(),
  projektFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kostnad: { findFirst: h.kostnadFindFirst, update: h.kostnadUpdate },
    kostnadsrad: {
      deleteMany: h.kostnadsradDeleteMany,
      create: h.kostnadsradCreate,
    },
    projekt: { findFirst: h.projektFindFirst },
    $transaction: h.transaction,
  },
}));

vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({ bostadId: BOSTAD })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { redigeraKostnad } from "@/app/kostnad/[id]/actions";

/** En enkel, oredigerad kostnad – en enda rad utan fordelning. */
function kostnadRad(sparatTotalbeloppOren: number) {
  return {
    id: KOSTNAD,
    bostad_id: BOSTAD,
    leverantor: "Hantverkarn AB",
    totalbelopp: sparatTotalbeloppOren,
    betaldatum: new Date("2026-05-01T00:00:00.000Z"),
    anteckning: null,
    rot_utnyttjat: null,
    forsakringsersattning: 0,
    arkiverad: false,
    rader: [
      {
        id: "rad1",
        artikel: "Hantverkarn AB",
        belopp: sparatTotalbeloppOren,
        fordelningar: [],
      },
    ],
  };
}

function formulardata(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const varden: Record<string, string> = {
    kostnad_id: KOSTNAD,
    leverantor: "Hantverkarn AB",
    totalbelopp: "",
    dokumentdatum: "2026-05-01",
    betaldatum: "",
    projekt_id: "",
    anteckning: "",
    rot_utnyttjat: "",
    privatbelopp: "",
    ...over,
  };
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.kostnadUpdate.mockResolvedValue({});
  h.kostnadsradDeleteMany.mockResolvedValue({});
  h.kostnadsradCreate.mockResolvedValue({});
  h.transaction.mockResolvedValue([]);
});

describe("redigeraKostnad: ROT jamfors mot det NYSS INSKRIVNA totalbeloppet, i oren", () => {
  it("ett ROT-belopp mindre an det nya totalbeloppet passerar, aven om det ar storre an det gamla sparade beloppet", async () => {
    // Sparat sedan tidigare: 10 000 kr (1 000 000 öre). Skrivs nu om till
    // 344 250 kr med 75 000 kr i ROT. 75 000 < 344 250 ska passera, trots att
    // 75 000 > 10 000 (det gamla, sparade beloppet) – exakt buggens fall.
    h.kostnadFindFirst.mockResolvedValue(kostnadRad(1_000_000));

    const resultat = await redigeraKostnad(
      {},
      formulardata({ totalbelopp: "344 250", rot_utnyttjat: "75 000" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.transaction).toHaveBeenCalledOnce();
  });

  it("ett ROT-belopp storre an det nya totalbeloppet avvisas, aven om det ar mindre an det gamla sparade beloppet", async () => {
    // Sparat sedan tidigare: 1 000 000 kr – langt mer an ROT-beloppet. Skrivs
    // nu ner till 50 000 kr med 75 000 kr i ROT: 75 000 > 50 000 ska avvisas,
    // trots att 75 000 < 1 000 000 (det gamla, sparade beloppet).
    h.kostnadFindFirst.mockResolvedValue(kostnadRad(100_000_000));

    const resultat = await redigeraKostnad(
      {},
      formulardata({ totalbelopp: "50 000", rot_utnyttjat: "75 000" }),
    );

    expect(resultat.fel).toBe(
      "ROT-avdraget kan inte vara större än totalbeloppet.",
    );
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("ett ROT-belopp lika stort som totalbeloppet ar tillatet, inte 'storre an'", async () => {
    h.kostnadFindFirst.mockResolvedValue(kostnadRad(1));

    const resultat = await redigeraKostnad(
      {},
      formulardata({ totalbelopp: "75 000", rot_utnyttjat: "75 000" }),
    );

    expect(resultat.fel).toBeUndefined();
  });
});
