// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// När det inte går att avgöra om ROT-avdraget redan är avräknat lämnas
// beloppet tomt med ett besked som säger varför (docs/design.md,
// "Totalbeloppet är summan före ROT", punkt 3). Lydelsen läses ur
// designfilen, inte ur koden.

const h = vi.hoisted(() => ({ falt: null as Record<string, unknown> | null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  taBortKostnad: vi.fn(async () => ({})),
  taBortBilagaAction: vi.fn(async () => ({})),
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortUtkastRad: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: vi.fn() }));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: vi.fn(async () => ({ kord: true, falt: h.falt })),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/kostnad/nytt/actions", () => ({
  skapaUtkast: vi.fn(async () => ({})),
  sparaKostnad: vi.fn(async () => ({})),
  sparaUtkastfalten: vi.fn(async () => ({})),
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NyKostnadForm } from "@/app/kostnad/nytt/form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Beskedet, ordagrant ur docs/design.md – läst i provet, inte på modulnivå. */
function besked(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(/^3\. \*\*Går det inte att fastställa lämnas fältet tomt\*\*, med ett besked som säger varför: \*"([^"]+)"\*/m);
  if (!m) throw new Error("design.md saknar beskedet under Totalbeloppet är summan före ROT, punkt 3");
  return m[1];
}

const LAST = {
  betaldatum: "2026-03-14",
  dokumentdatum: "2026-03-02",
  leverantor: "Badrumsfixarna i Norr AB",
  totalbelopp: null,
  rot_utnyttjat: 648000,
};

let behallare: HTMLDivElement;
let rot: Root;

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

/** Ett återupptaget utkast med en oavläst bilaga: formuläret läser av den själv. */
async function oppnaUtkast() {
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () =>
    rot.render(
      createElement(NyKostnadForm, {
        bostad: { id: "b0000000-0000-4000-8000-0000000000c7", namn: null },
        innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
        utkast: {
          id: "k0000000-0000-4000-8000-0000000000c7",
          anteckning: null,
          bilagor: [{ id: "d0000000-0000-4000-8000-0000000000c7", filnamn: "faktura.png", arPdf: false, arBild: false, analyserad: false, sidantal: null } as never],
        },
      }),
    ),
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Hjälptexten under Totalbelopp, som hela elementets text. */
function beloppetsHjalp(): string {
  const falt = behallare.querySelector('input[name="totalbelopp"]');
  if (!falt) throw new Error("hittade inget totalbeloppsfält");
  const etikett = falt.closest("label");
  if (!etikett) throw new Error("totalbeloppsfältet ligger inte i en etikett");
  const texter = [...etikett.querySelectorAll("p, span")].map((e) => e.textContent ?? "");
  const traff = texter.filter((t) => t === besked() || t === "Kunde inte läsas av kvittot – fyll i för hand.");
  return traff[0] ?? "";
}

describe("beloppet tomt för att ROT-avräkningen inte gick att avgöra", () => {
  it("fältet säger varför, med designfilens ord", async () => {
    h.falt = { ...LAST, rot_avrakning_oklar: true };
    await oppnaUtkast();
    expect(behallare.querySelector<HTMLInputElement>('input[name="totalbelopp"]')!.value).toBe("");
    expect(beloppetsHjalp()).toBe(besked());
  });

  it("ett belopp som bara inte gick att läsa får det vanliga beskedet", async () => {
    h.falt = { ...LAST, rot_avrakning_oklar: false };
    await oppnaUtkast();
    expect(beloppetsHjalp()).toBe("Kunde inte läsas av kvittot – fyll i för hand.");
  });
});
