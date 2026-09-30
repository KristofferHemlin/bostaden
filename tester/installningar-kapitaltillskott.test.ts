import { beforeEach, describe, expect, it, vi } from "vitest";

// Kapitaltillskott i kortet Bostaden (docs/design.md, "Installningssidan").
// Det finns bara for bostadsratt (produktspec 4.8) – ett falt som uteblir for
// en fastighet, inte ett kort som forsvinner. Kortet Kopet, dar faltet lag
// forut, togs bort 2026-09-30.
//
// Faltet foljer upplatelseformen i SAMMA sparning: formularet skickar den form
// som ar vald, servern provar den mot lasningen efter forsaljning, och ar den
// fastighet sparas kapitaltillskott som null – oavsett vad formularet skulle
// raka innehalla.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANVANDARE = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  bostadFindUniqueOrThrow: vi.fn(),
  bostadUpdate: vi.fn(),
  medlemskapUpdateMany: vi.fn(),
  medlemskapFindMany: vi.fn(),
  inbjudanFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const klient = {
    bostad: { findUniqueOrThrow: h.bostadFindUniqueOrThrow, update: h.bostadUpdate },
    medlemskap: { updateMany: h.medlemskapUpdateMany, findMany: h.medlemskapFindMany },
    inbjudan: { findMany: h.inbjudanFindMany },
  };
  return { prisma: { ...klient, $transaction: (fn: (k: typeof klient) => unknown) => fn(klient) } };
});

vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({
    anvandareId: ANVANDARE,
    bostadId: BOSTAD,
    agarandel: 100,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

/** Standard: en ensam agare pa 100 %, inga utestaende inbjudningar. */
function ensamAgare() {
  h.medlemskapFindMany.mockResolvedValue([
    { agarandel: 100, anvandare: { id: ANVANDARE, epost: "anna@exempel.se" } },
  ]);
  h.inbjudanFindMany.mockResolvedValue([]);
}

import { sparaBostaden } from "@/app/installningar/actions";

function formulardata(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const varden: Record<string, string> = {
    upplatelseform: "bostadsratt",
    adress: "Ulriksborgsgatan 7",
    storlek: "",
    kapitaltillskott: "",
    ...over,
  };
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

const sparat = () => h.bostadUpdate.mock.calls[0][0].data.kapitaltillskott;

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
  h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "bostadsratt", forsaljningsdatum: null });
  ensamAgare();
});

describe("kapitaltillskott foljer upplatelseformen", () => {
  it("sparas som det angivna beloppet for en bostadsratt", async () => {
    const resultat = await sparaBostaden({}, formulardata({ kapitaltillskott: "60 000" }));

    expect(resultat.fel).toBeUndefined();
    expect(sparat()).toBe(6_000_000n);
  });

  it("sparas som null for en fastighet, aven om ett belopp skickades med", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "fastighet", forsaljningsdatum: null });

    const resultat = await sparaBostaden(
      {},
      formulardata({ upplatelseform: "fastighet", kapitaltillskott: "60 000" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(sparat()).toBeNull();
  });

  it("nollstalls i samma sparning som formen byts till fastighet", async () => {
    const resultat = await sparaBostaden(
      {},
      formulardata({ upplatelseform: "fastighet", kapitaltillskott: "60 000" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate.mock.calls[0][0].data.upplatelseform).toBe("fastighet");
    expect(sparat()).toBeNull();
  });

  it("ett tomt falt sparas som null", async () => {
    await sparaBostaden({}, formulardata());
    expect(sparat()).toBeNull();
  });

  it("ett otolkbart kapitaltillskott avvisas for en bostadsratt", async () => {
    const resultat = await sparaBostaden({}, formulardata({ kapitaltillskott: "hej" }));

    expect(resultat.fel).toBeTruthy();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });
});
