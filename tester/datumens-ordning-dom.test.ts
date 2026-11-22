// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// De två datumen står alltid intill varandra, och i samma ordning på varje
// skärm (docs/design.md, "De två datumen står alltid intill varandra"). Båda
// skärmarna renderas med båda fälten synliga, och ingen annan kontroll får stå
// mellan dem. Ordningen läses ur designfilen, inte ur koden.

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
  redigeraKostnad: vi.fn(async () => ({})),
  sattHorInteTillBostaden: vi.fn(async () => ({})),
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

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NyKostnadForm } from "@/app/kostnad/nytt/form";
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Ordningen ur docs/design.md – läst i provet, inte på modulnivå. */
function ordningen(): [string, string] {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(/\*\*Ordningen är \*([^*]+)\* först och \*([^*]+)\* direkt under\*\*/);
  if (!m) throw new Error("design.md saknar ordningen för de två datumen");
  return [m[1], m[2]];
}

let behallare: HTMLDivElement;
let rot: Root;

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

async function rendera(vy: ReactElement) {
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () => rot.render(vy));
}

/** Fältets etikett: etikettens första rad, utan markeringen för obligatoriskt. */
function etikettText(l: HTMLLabelElement): string {
  return (l.querySelector(":scope > span")?.firstChild?.textContent ?? "").trim();
}

/**
 * Var och en av de två datumens etiketter, och varje kontroll som står mellan
 * dem i dokumentordningen – utom de som hör till det första fältet självt.
 */
function mellanDatumen(forsta: string, andra: string): { forstaFore: boolean; emellan: string[] } {
  const etiketter = [...behallare.querySelectorAll("label")].filter((l) => !l.parentElement?.closest("label"));
  const hitta = (namn: string) => {
    const traff = etiketter.filter((l) => etikettText(l) === namn);
    expect(traff, `fältet "${namn}" ska stå en gång`).toHaveLength(1);
    return traff[0];
  };
  const a = hitta(forsta);
  const b = hitta(andra);
  const forstaFore = Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const [fore, efter] = forstaFore ? [a, b] : [b, a];
  const emellan = [...behallare.querySelectorAll("label, input, select, textarea, button")]
    .filter((e) => !(e instanceof HTMLInputElement && e.type === "hidden"))
    .filter((e) => !fore.contains(e) && e !== fore)
    .filter(
      (e) =>
        fore.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING &&
        efter.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING,
    )
    .map((e) => (e instanceof HTMLLabelElement ? `fält "${etikettText(e)}"` : `${e.tagName.toLowerCase()} "${e.textContent ?? ""}"`));
  return { forstaFore, emellan };
}

const SKARMAR: Record<string, () => Promise<void>> = {
  // Ett återupptaget utkast vars avlästa kvitto har ett annat datum än
  // betaldagen: då står "Kvittots datum" under betaldatumet.
  inmatningen: async () => {
    h.falt = {
      betaldatum: "2026-03-14",
      dokumentdatum: "2026-03-02",
      leverantor: "Badrumsfixarna i Norr AB",
      totalbelopp: 4380750,
      rot_utnyttjat: null,
    };
    await rendera(
      createElement(NyKostnadForm, {
        bostad: { id: "b0000000-0000-4000-8000-0000000000f3", namn: null },
        innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
        utkast: {
          id: "k0000000-0000-4000-8000-0000000000f3",
          anteckning: null,
          bilagor: [{ id: "d0000000-0000-4000-8000-0000000000f3", filnamn: "faktura.png", arPdf: false, arBild: false, analyserad: false, sidantal: null } as never],
        },
      }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  },
  andringslaget: async () => {
    await rendera(
      createElement(RedigeraVy, {
        kostnadId: "k0000000-0000-4000-8000-0000000000f4",
        projekt: [],
        varden: {
          leverantor: "Bauhaus", totalbelopp: "1 250,00", totalbeloppVisning: 125000, dokumentdatum: "2026-03-02",
          betaldatum: "2026-03-14", projektId: "", rotUtnyttjat: "", anteckning: "",
        },
        innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
        privatDel: { forvalt: "" },
        arkiverad: false,
        onAvbryt: () => {},
        onSparat: () => {},
      } as never),
    );
  },
};

describe("de två datumen står intill varandra, i designfilens ordning", () => {
  it.each(Object.keys(SKARMAR))("%s", async (skarm) => {
    const [forsta, andra] = ordningen();
    await SKARMAR[skarm]();
    const { forstaFore, emellan } = mellanDatumen(forsta, andra);
    expect(forstaFore, `"${forsta}" står före "${andra}"`).toBe(true);
    expect(emellan, `ingenting mellan "${forsta}" och "${andra}"`).toEqual([]);
  });
});
