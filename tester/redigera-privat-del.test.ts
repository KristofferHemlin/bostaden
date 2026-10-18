import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Ett kvitto med privat del gick inte att spara i andringslaget
// (uppmatt 2026-10-18): granssnittet visade "Totalbelopp" och "Koppla till
// projekt" bara for ett kvitto med EN rad, medan servern kravde beloppet sa
// fort den kande igen den privata uppdelningen (tva rader). Varje sparning –
// aven av bara datumet – avvisades med "Fyll i ett belopp större än noll".
//
// Fallan i rattningen: visas bara beloppsfaltet sparas formularet utan
// projektkoppling, och kvittot kopplas tyst loss fran sitt projekt. Testerna
// nedan haller bada sakerna: falten visas, och kopplingen ligger kvar.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const KOSTNAD = "22222222-2222-2222-2222-222222222222";
const PROJEKT = "33333333-3333-3333-3333-333333333333";

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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { redigeraKostnad } from "@/app/kostnad/[id]/actions";
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";

/** 10 000 kr, varav 1 000 kr privat och resten kopplat till projektet. */
function kvittoMedPrivatDel() {
  return {
    id: KOSTNAD,
    bostad_id: BOSTAD,
    leverantor: "Bauhaus",
    totalbelopp: 1_000_000,
    betaldatum: new Date("2026-05-01T00:00:00.000Z"),
    dokumentdatum: new Date("2026-05-01T00:00:00.000Z"),
    anteckning: null,
    rot_utnyttjat: null,
    forsakringsersattning: 0,
    arkiverad: false,
    rader: [
      {
        id: "r1",
        artikel: "Privat",
        belopp: 100_000,
        fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
      },
      {
        id: "r2",
        artikel: "Bauhaus",
        belopp: 900_000,
        fordelningar: [{ projekt_id: PROJEKT, privat: false, andel: 1 }],
      },
    ],
  };
}

function formulardata(varden: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(varden)) data.set(k, v);
  return data;
}

/** Projekt-id pa de rader som skapades vid sparningen (Privat-raden har inget). */
function kopplingarEfterSparning(): (string | null)[] {
  return h.kostnadsradCreate.mock.calls.flatMap(
    ([arg]) =>
      (arg.data.fordelningar?.create ?? []) as { projekt_id: string | null; privat: boolean }[],
  )
    .filter((f) => !f.privat)
    .map((f) => f.projekt_id);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.kostnadFindFirst.mockResolvedValue(kvittoMedPrivatDel());
  h.kostnadUpdate.mockResolvedValue({});
  h.kostnadsradDeleteMany.mockResolvedValue({});
  h.kostnadsradCreate.mockImplementation(async (x) => x);
  h.projektFindFirst.mockResolvedValue({ id: PROJEKT });
  h.transaction.mockImplementation(async (ops: unknown[]) => ops);
});

describe("ändringsläget för ett kvitto med privat del", () => {
  it("visar Totalbelopp och projektlistan, med projektet förvalt", () => {
    const html = renderToStaticMarkup(
      createElement(RedigeraVy, {
        kostnadId: KOSTNAD,
        projekt: [{ id: PROJEKT, namn: "Målade sovrummet", ar: 2026 }],
        varden: {
          leverantor: "Bauhaus",
          totalbelopp: "10000,00",
          totalbeloppVisning: 1_000_000,
          dokumentdatum: "2026-05-01",
          betaldatum: "2026-05-01",
          projektId: PROJEKT,
          rotUtnyttjat: "",
          anteckning: "",
        },
        innehav: { tilltradesdatum: "2016-06-01", forsaljningsdatum: null },
        privatDel: { forvalt: "1000,00" },
        onAvbryt: () => {},
        onSparat: () => {},
      }),
    );
    expect(html).toContain('name="totalbelopp"');
    expect(html).toContain('name="projekt_id"');
    expect(html).toMatch(new RegExp(`<option value="${PROJEKT}" selected=""`));
    expect(html).toContain('name="privatbelopp"');
  });
});

describe("sparning av ett kvitto med privat del", () => {
  it("går igenom när bara leverantören rättas, och projektkopplingen ligger kvar", async () => {
    // Som formularet skickar det nu: belopp, projekt (forvalt) och privatdel.
    const resultat = await redigeraKostnad(
      {},
      formulardata({
        kostnad_id: KOSTNAD,
        leverantor: "Bauhaus Bromma",
        totalbelopp: "10 000,00",
        dokumentdatum: "2026-05-01",
        betaldatum: "2026-05-01",
        projekt_id: PROJEKT,
        anteckning: "",
        rot_utnyttjat: "",
        privatbelopp: "1 000,00",
      }),
    );
    expect(resultat.fel).toBeUndefined();
    expect(kopplingarEfterSparning()).toEqual([PROJEKT]);
  });

  it("utan projektfältet i formuläret ligger kopplingen ändå kvar", async () => {
    // Som formularet sag ut fore rattningen: varken belopp eller projekt.
    // Ett falt som inte visats far aldrig tolkas som "kopplat loss".
    const resultat = await redigeraKostnad(
      {},
      formulardata({
        kostnad_id: KOSTNAD,
        leverantor: "Bauhaus Bromma",
        dokumentdatum: "2026-05-01",
        betaldatum: "2026-05-01",
        anteckning: "",
        rot_utnyttjat: "",
        privatbelopp: "1 000,00",
      }),
    );
    expect(resultat.fel).toBeUndefined();
    expect(kopplingarEfterSparning()).toEqual([PROJEKT]);
  });

  it("'– inget projekt –' kopplar fortfarande loss med avsikt", async () => {
    const resultat = await redigeraKostnad(
      {},
      formulardata({
        kostnad_id: KOSTNAD,
        leverantor: "Bauhaus",
        totalbelopp: "10 000,00",
        dokumentdatum: "2026-05-01",
        betaldatum: "2026-05-01",
        projekt_id: "",
        anteckning: "",
        rot_utnyttjat: "",
        privatbelopp: "1 000,00",
      }),
    );
    expect(resultat.fel).toBeUndefined();
    expect(kopplingarEfterSparning()).toEqual([]);
  });
});
