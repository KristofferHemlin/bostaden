import { beforeEach, describe, expect, it, vi } from "vitest";

// Upplatelseformen gar att byta fram till forsaljningen, aldrig efter
// (docs/produktspec.md 4.8). Klientens lasning av korten (form.tsx) ar bara
// UX – dessa tester galler serverns egen sparr i sparaInstallningar, som
// maste galla aven om formularet av nagon anledning skickar ett andrat
// varde trots att bostaden ar sald.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANVANDARE = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  bostadFindUniqueOrThrow: vi.fn(),
  bostadUpdate: vi.fn(),
  medlemskapUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bostad: {
      findUniqueOrThrow: h.bostadFindUniqueOrThrow,
      update: h.bostadUpdate,
    },
    medlemskap: { updateMany: h.medlemskapUpdateMany },
  },
}));

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

import { sparaInstallningar } from "@/app/installningar/actions";

function formulardata(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const varden: Record<string, string> = {
    upplatelseform: "bostadsratt",
    tilltradesdatum: "2018-06-01",
    storlek: "",
    kopeskilling: "",
    kopkostnader: "",
    agarandel: "",
    kapitaltillskott: "",
    identifiering: "",
    ...over,
  };
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
  h.medlemskapUpdateMany.mockResolvedValue({ count: 1 });
});

describe("byte av upplatelseform nekas efter forsaljning", () => {
  it("avvisar ett byte fran bostadsratt till fastighet nar forsaljningsdatum finns", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: new Date("2026-03-01"),
    });

    const resultat = await sparaInstallningar(
      {},
      formulardata({ upplatelseform: "fastighet" }),
    );

    expect(resultat.fel).toBeTruthy();
    expect(resultat.meddelande).toBeUndefined();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });

  it("tillater att spara ovriga falt efter forsaljning sa lange upplatelseformen ar ofortandrad", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: new Date("2026-03-01"),
    });

    const resultat = await sparaInstallningar(
      {},
      formulardata({ upplatelseform: "bostadsratt", storlek: "72" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledOnce();
  });

  it("tillater ett byte fore forsaljning (forsaljningsdatum null)", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: null,
    });

    const resultat = await sparaInstallningar(
      {},
      formulardata({ upplatelseform: "fastighet" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledOnce();
  });
});

describe("kapitaltillskottet nollstalls vid byte till fastighet", () => {
  it("sparar kapitaltillskott som null nar upplatelseformen blir fastighet, aven om ett belopp skickades med", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: null,
    });

    await sparaInstallningar(
      {},
      formulardata({ upplatelseform: "fastighet", kapitaltillskott: "60 000" }),
    );

    expect(h.bostadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kapitaltillskott: null }),
      }),
    );
  });

  it("sparar det angivna kapitaltillskottet nar upplatelseformen ar bostadsratt", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({
      upplatelseform: "bostadsratt",
      forsaljningsdatum: null,
    });

    await sparaInstallningar(
      {},
      formulardata({ upplatelseform: "bostadsratt", kapitaltillskott: "60 000" }),
    );

    expect(h.bostadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kapitaltillskott: 6_000_000n }),
      }),
    );
  });
});
