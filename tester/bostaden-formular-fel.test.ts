import { describe, expect, it, vi } from "vitest";

// Fragorna fran startsidans kort vagrar som alla andra formular (docs/design.md,
// "När ett formulär vägrar"): meningen vid sitt falt, med aria-invalid och
// bindning.

const h = vi.hoisted(() => ({ resultat: {} as Record<string, unknown> }));

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useActionState: () => [h.resultat, () => {}, false] };
});
vi.mock("@/app/bostaden/actions", () => ({
  sparaKopeskillingen: vi.fn(),
  sparaAndelen: vi.fn(),
}));
vi.mock("@/app/inbjudan/actions", () => ({
  skapaInbjudanAction: vi.fn(),
  aterkallaInbjudanAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AndelFormular, KopeskillingFormular } from "@/app/bostaden/formular";
import { KOPESKILLING_SAKNAS } from "@/app/bostaden/validering";
import { ANDEL_SAKNAS } from "@/lib/agarandel";

function arBundet(html: string, name: string, mening: string) {
  const tagg = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))![0];
  expect(tagg).toContain('aria-invalid="true"');
  const id = tagg.match(/aria-describedby="([^"]+)"/)?.[1];
  expect(id, "saknar aria-describedby").toBeTruthy();
  const esc = mening.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(html).toMatch(new RegExp(`id="${id}" role="alert"[^>]*>${esc}<`));
}

describe("frågorna visar meningen vid fältet", () => {
  it("köpeskillingen", () => {
    h.resultat = { fel: KOPESKILLING_SAKNAS, falt: "kopeskilling" };
    const html = renderToStaticMarkup(createElement(KopeskillingFormular, { forval: "" }));
    arBundet(html, "kopeskilling", KOPESKILLING_SAKNAS);
  });

  it("ägarandelen", () => {
    h.resultat = { fel: ANDEL_SAKNAS, falt: "agarandel" };
    const html = renderToStaticMarkup(createElement(AndelFormular, { forval: "", franExport: false }));
    arBundet(html, "agarandel", ANDEL_SAKNAS);
  });
});
