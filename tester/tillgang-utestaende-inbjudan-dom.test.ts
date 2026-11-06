// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Kortet Tillgang med en utestaende inbjudan, provat i en DOM (docs/design.md,
// "Att bjuda in en delägare"): adressen, "Väntar på svar", en vag tillbaka
// till samma lank och QR-kod, och ett satt att aterkalla. Lanken och koden
// ar serverns – att det ar SAMMA lank provas i
// tester/tillgang-utestaende-inbjudan.test.ts.

const h = vi.hoisted(() => ({
  visa: vi.fn(),
  aterkalla: vi.fn(async () => ({})),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/app/inbjudan/actions", () => ({
  skapaInbjudanAction: vi.fn(async () => ({})),
  aterkallaInbjudanAction: h.aterkalla,
  visaInbjudanAction: h.visa,
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TillgangKort, type TillgangData } from "@/app/installningar/dela-bostaden";
import { formateraAndelEllerInteAngiven } from "@/lib/samagande";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const vantar = () => {
  const m = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8").match(
    /bara blivit tillfrågad\. \*([^*]+)\* säger vilket\./,
  );
  if (!m) throw new Error("design.md saknar raden om Väntar på svar");
  return m[1];
};

const INBJUDAN = "e0000000-0000-4000-8000-0000000000d1";
const LANK = `https://bostad.test/inbjudan/${INBJUDAN}`;
const DATA: TillgangData = {
  medlemmar: [
    { epost: "anna@exempel.se", du: true, andel: 50 },
    { epost: "bertil@exempel.se", du: false, andel: 25 },
  ],
  inbjudningar: [{ id: INBJUDAN, epost: "doris@exempel.se", andel: 25 }],
};

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(async () => {
  h.visa.mockReset();
  h.visa.mockResolvedValue({ ok: true, lank: LANK, qrSvg: "<svg data-qr></svg>", epost: "doris@exempel.se", harKonto: false });
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () => rot.render(createElement(TillgangKort, { data: DATA })));
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

const knapp = (text: string) => [...behallare.querySelectorAll("button")].find((b) => b.textContent === text);
const texter = () => [...behallare.querySelectorAll("span, p")].map((e) => e.textContent);

/** Raden "Väntar på svar" och texten narmast ovanfor den. */
function vantarUnder(): string[] {
  return [...behallare.querySelectorAll("p")]
    .filter((p) => p.textContent === vantar())
    .map((p) => p.previousElementSibling?.textContent ?? "");
}

describe("en utestaende inbjudan i kortet Tillgang", () => {
  it("visar adressen som den skrevs, och Väntar på svar under den", () => {
    expect(texter()).toContain("doris@exempel.se");
    // Adressen och andelen pa raden ovanfor – hela texten, inte en delstrang.
    expect(vantarUnder()).toEqual([`doris@exempel.se${formateraAndelEllerInteAngiven(25)}`]);
  });

  it("ett medlemskap bar inte raden – den skiljer inbjudan fran medlemmen", () => {
    expect(vantarUnder()).toHaveLength(1);
    // Forutsattningen: medlemmen star i kortet.
    expect(texter()).toContain("bertil@exempel.se");
  });

  it("har en vag tillbaka till lanken och koden, och ett satt att aterkalla", async () => {
    expect(knapp("Återkalla")).toBeDefined();
    expect(behallare.querySelector('input[aria-label="Länk till inbjudan"]')).toBeNull();

    await act(async () => knapp("Visa länken igen")!.click());
    expect(h.visa).toHaveBeenCalledTimes(1);
    const skickat = h.visa.mock.calls[0]![1] as FormData;
    expect(skickat.get("inbjudan_id")).toBe(INBJUDAN);

    expect(behallare.querySelector<HTMLInputElement>('input[aria-label="Länk till inbjudan"]')!.value).toBe(LANK);
    expect(behallare.querySelector('[aria-label="QR-kod till inbjudan"] svg[data-qr]')).not.toBeNull();

    // Klar stanger koden, och vagen tillbaka finns kvar.
    await act(async () => knapp("Klar")!.click());
    expect(behallare.querySelector('input[aria-label="Länk till inbjudan"]')).toBeNull();
    expect(knapp("Visa länken igen")).toBeDefined();
  });

  it("aterkallningen skickar inbjudans id", async () => {
    await act(async () => knapp("Återkalla")!.click());
    expect(h.aterkalla).toHaveBeenCalledTimes(1);
    expect((h.aterkalla.mock.calls[0] as unknown as [unknown, FormData])[1].get("inbjudan_id")).toBe(INBJUDAN);
  });
});
