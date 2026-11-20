// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Den privata delen säger inklusive moms (docs/design.md, "Momsen står i
// hjälptexten, och det är inte en detalj"). Kvittots belopp är inklusive
// moms, och det som dras ifrån måste vara det också; läser hon en nettorad blir
// bostadens del för hög. Lydelsen läses ur designfilen, och ställena räknas
// upp ur koden – varje fil med ett fält för den privata delen ska prövas här.

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
  analyseraBilaga: vi.fn(async () => ({})),
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

/** Lydelsen ur docs/design.md – läst i provet, inte på modulnivå. */
function lydelse(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(/Lydelserna är desamma på båda ställena: \*"Var något på kvittot privat\?"\* och \*"([^"]+)"\*/);
  if (!m) throw new Error("design.md saknar lydelsen för den privata delen");
  return m[1];
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

/** Hjälptexten vid fältet för den privata delen, som hela elementets text. */
function hjalptexten(): string {
  const falt = behallare.querySelector('input[name="privatbelopp"]');
  if (!falt) throw new Error("hittade inget fält för den privata delen");
  const etikett = falt.closest("label");
  if (!etikett) throw new Error("fältet ligger inte i en etikett");
  const traff = [...etikett.querySelectorAll("p, span")].map((e) => e.textContent ?? "").filter((t) => /hörde till bostaden/.test(t));
  expect(traff, "fältets hjälptext").toHaveLength(1);
  return traff[0];
}

const SKARMAR: Record<string, { fil: string; oppna: () => Promise<void> }> = {
  inmatningen: {
    fil: "src/app/kostnad/nytt/form.tsx",
    oppna: async () => {
      await rendera(
        createElement(NyKostnadForm, {
          bostad: { id: "b0000000-0000-4000-8000-0000000000e9", namn: null },
          innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
        }),
      );
      const fraga = [...behallare.querySelectorAll("button")].find((b) => b.textContent === "Var något på kvittot privat?");
      if (!fraga) throw new Error("hittade inte frågan om den privata delen");
      await act(async () => fraga.click());
    },
  },
  andringslaget: {
    fil: "src/app/kostnad/[id]/kvitto-kort.tsx",
    oppna: async () => {
      await rendera(
        createElement(RedigeraVy, {
          kostnadId: "k0000000-0000-4000-8000-0000000000e9",
          projekt: [],
          varden: {
            leverantor: "Bauhaus", totalbelopp: "1 250,00", totalbeloppVisning: 125000, dokumentdatum: "2026-05-01",
            betaldatum: "2026-05-01", projektId: "", rotUtnyttjat: "", anteckning: "",
          },
          innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
          privatDel: { forvalt: "" },
          arkiverad: false,
          onAvbryt: () => {},
          onSparat: () => {},
        } as never),
      );
    },
  },
};

describe("den privata delen säger inklusive moms, på varje ställe", () => {
  it.each(Object.keys(SKARMAR))("%s: designfilens lydelse", async (skarm) => {
    await SKARMAR[skarm].oppna();
    expect(hjalptexten()).toBe(lydelse());
  });

  it("varje fil i src/ med ett fält för den privata delen prövas ovan", () => {
    const filer: string[] = [];
    const ga = (katalog: string) => {
      for (const d of readdirSync(join(process.cwd(), katalog), { withFileTypes: true })) {
        const fil = join(katalog, d.name);
        if (d.isDirectory()) ga(fil);
        else if (/\.tsx$/.test(d.name) && readFileSync(join(process.cwd(), fil), "utf8").includes('name="privatbelopp"')) filer.push(fil);
      }
    };
    ga("src");
    expect(filer.length, "förutsättningen: fälten hittades").toBeGreaterThan(0);
    expect(filer.sort()).toEqual(Object.values(SKARMAR).map((s) => s.fil).sort());
  });
});
