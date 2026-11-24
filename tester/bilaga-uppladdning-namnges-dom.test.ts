// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// En bilaga som inte gick att ladda upp namnges (uppräkningen 2026-11-24:
// "Bilagan som inte gick att ladda upp ska namnges"). Till dess sa beskedet
// "En bilaga", och med flera valda filer var det bara ramen runt miniatyren –
// en färg – som pekade ut vilken. Beskedet bär nu filens namn och role=alert.
//
// Lydelsen står inte i docs/design.md och vaktas inte här; provet kräver att
// den misslyckade filens namn står i beskedet och den lyckades inte gör det.

const h = vi.hoisted(() => ({ laddaUpp: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortBilagaAction: vi.fn(async () => ({})),
  taBortKostnad: vi.fn(async () => ({})),
  taBortUtkastRad: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: h.laddaUpp }));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: vi.fn(async () => ({})),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
  begarBilagauppladdning: vi.fn(async () => ({})),
  bekraftaBilagauppladdning: vi.fn(async () => ({})),
}));
vi.mock("@/app/kostnad/nytt/actions", () => ({
  skapaUtkast: vi.fn(async () => ({})),
  sparaKostnad: vi.fn(async () => ({})),
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NyKostnadForm } from "@/app/kostnad/nytt/form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  h.laddaUpp.mockReset();
  globalThis.URL.createObjectURL ??= () => "blob:x";
  globalThis.URL.revokeObjectURL ??= () => {};
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

const larm = () => [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent ?? "");

async function vantaPa(vad: string, finns: () => boolean) {
  for (let i = 0; i < 40 && !finns(); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  if (!finns()) throw new Error(`${vad} visades aldrig`);
}

async function valj(filer: File[]) {
  await act(async () =>
    rot.render(
      createElement(NyKostnadForm, {
        utkast: { id: "d0000000-0000-4000-8000-000000000001", anteckning: null, bilagor: [] },
        bostad: { id: "b0000000-0000-4000-8000-00000000000a", namn: null },
        innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
      }),
    ),
  );
  const input = behallare.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("hittade inget filfält");
  Object.defineProperty(input, "files", { value: filer, configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

const fil = (namn: string) => new File([new Uint8Array([0xff, 0xd8, 0xff])], namn, { type: "image/jpeg" });

describe("den bilaga som inte gick att ladda upp namnges", () => {
  it("två filer, den andra misslyckas: beskedet namnger den, inte den första", async () => {
    h.laddaUpp.mockImplementation(async (_id: string, f: File) =>
      f.name === "faktura-sida-2.jpg" ? { ok: false, fel: "nätverket svarade inte." } : { ok: true, bilagaId: "e1" },
    );
    await valj([fil("faktura-sida-1.jpg"), fil("faktura-sida-2.jpg")]);
    await vantaPa("beskedet", () => larm().some((t) => t.includes("kunde inte laddas upp")));
    expect(h.laddaUpp, "förutsättningen: båda laddades upp").toHaveBeenCalledTimes(2);
    const besked = larm().filter((t) => t.includes("kunde inte laddas upp"));
    expect(besked).toHaveLength(1);
    expect(besked[0]).toContain("faktura-sida-2.jpg");
    expect(besked[0]).not.toContain("faktura-sida-1.jpg");
    expect(besked[0]).not.toMatch(/^En bilaga/);
  });

  it("båda misslyckas: båda namnges i samma besked", async () => {
    h.laddaUpp.mockResolvedValue({ ok: false, fel: "nätverket svarade inte." });
    await valj([fil("a.jpg"), fil("b.jpg")]);
    await vantaPa("beskedet", () => larm().some((t) => t.includes("kunde inte laddas upp")));
    const [besked] = larm().filter((t) => t.includes("kunde inte laddas upp"));
    expect(besked).toContain("a.jpg");
    expect(besked).toContain("b.jpg");
  });
});
