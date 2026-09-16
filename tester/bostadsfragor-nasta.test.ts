import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/produktspec.md 4.1, "Efter frågorna hamnar man i grupperingen, oavsett
// vilken ingång som utlöste grinden": den som just svarat för första gången
// har per definition inget grupperat, så sparaBostadsfragor ska som standard
// skicka till grupperingen (/genomgang) – inte till fas 2, som annars bara
// möter en tom bostad med "Inget mer att klassificera". Undantaget är
// ingången från ett enskilt projekts "Klassificera högen"
// (bostadsfragor.tsx skickar då med nasta="/genomgang/fragor"), där något
// faktiskt finns att klassificera.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANVANDARE = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  bostadUpdate: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bostad: { update: h.bostadUpdate },
  },
}));

vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({
    anvandareId: ANVANDARE,
    bostadId: BOSTAD,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// redirect() kastar i den riktiga implementationen (NEXT_REDIRECT) – har finns
// inget efter anropet i sparaBostadsfragor, sa en icke-kastande mock racker
// for att fanga vilken destination som skickades med.
vi.mock("next/navigation", () => ({
  redirect: h.redirect,
}));

import { sparaBostadsfragor } from "@/app/genomgang/fragor/actions";

function formulardata(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const varden: Record<string, string> = {
    forsta_agare: "nej",
    ombildning: "",
    ...over,
  };
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
});

describe("sparaBostadsfragor skickar till rätt nästa steg", () => {
  it("skickar till grupperingen som standard, utan nasta-fältet", async () => {
    await sparaBostadsfragor({}, formulardata());

    expect(h.redirect).toHaveBeenCalledWith("/genomgang");
  });

  it("skickar till grupperingen när nasta har ett okänt/manipulerat värde", async () => {
    await sparaBostadsfragor({}, formulardata({ nasta: "https://evil.example" }));

    expect(h.redirect).toHaveBeenCalledWith("/genomgang");
  });

  it("skickar till fas 2 när ingången var ett enskilt projekts 'Klassificera högen'", async () => {
    await sparaBostadsfragor(
      {},
      formulardata({ nasta: "/genomgang/fragor" }),
    );

    expect(h.redirect).toHaveBeenCalledWith("/genomgang/fragor");
  });
});
