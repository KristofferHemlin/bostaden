// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Raderna under Återstår står i årsordning (docs/design.md, "Kvittoraderna
// under Återstår står i årsordning, inte i inläggningsordning"). Till
// 2026-11-20 stod högarna i årsordning men kvittoraderna i den ordning de lades
// in, med årtalet bredvid – 2025, 2019, 2024 under varandra. En lista som
// visar ett tal per rad sorteras på det talet.
//
// Kvittona läggs in i en ordning som inte är årsordning, så att ett prov som
// bara läser inläggningsordningen faller.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return { db: skapaFalskDatabas(), inloggad: null as { id: string; email: string } | null };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/export",
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import ExportSida from "@/app/export/page";
import { ATERSTAR_RUBRIK } from "@/lib/aterstar";

const ANNA = "a0000000-0000-4000-8000-0000000000f7";
const X = "b0000000-0000-4000-8000-0000000000f7";
const HOGEN = "c0000000-0000-4000-8000-0000000000f7";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2018-06-01"),
    nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // En hög som väntar på frågorna, med ett kvitto från 2023.
  db.lagg("projekt", { id: HOGEN, bostad_id: X, namn: "Badrummet", ar: 2026, atgardstyp: null, skapad_at: datum("2026-01-01") });
  // Inlagda i ordningen 2025, 2019, 2023 (högens), 2024 och utan betaldatum.
  const kvitton: [string, string | null, string | null][] = [
    ["Färghandeln", "2025-03-01", null],
    ["Listfabriken", "2019-05-01", null],
    ["Kakelhuset", "2023-04-01", HOGEN],
    ["Golvbutiken", "2024-08-01", null],
    ["Fogmästarna", null, null],
  ];
  kvitton.forEach(([leverantor, betald, projekt], i) => {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor, totalbelopp: 600_000,
      dokumentdatum: datum(betald ?? "2026-02-01"), betaldatum: betald ? datum(betald) : null,
      skapad_at: datum(`2026-03-0${i + 1}`),
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 600_000 });
    if (projekt) db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projekt, andel: 1 });
  });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Återstårs rader som de står: namnet och året, i ordning. Stannar om
 *  listan inte hittas. */
async function aterstar(): Promise<{ namn: string; ar: string | null }[]> {
  const d = document.createElement("div");
  d.innerHTML = renderToStaticMarkup(await ExportSida());
  const rubrik = [...d.querySelectorAll("p")].find((p) => p.textContent === ATERSTAR_RUBRIK);
  if (!rubrik) throw new Error("underlaget saknar Återstår");
  const lista = rubrik.parentElement!.querySelector("ul");
  if (!lista) throw new Error("Återstår saknar sin lista");
  return [...lista.querySelectorAll(":scope > li")].map((li) => {
    const tal = [...li.querySelectorAll(":scope > span:last-child > span")].map((e) => e.textContent ?? "");
    const ar = tal.find((t) => /^\d{4}$/.test(t)) ?? null;
    const namn = li.querySelector(":scope > span:first-child > span:first-child")!.textContent!.trim();
    return { namn, ar };
  });
}

describe("Återstår i årsordning", () => {
  it("kvittoraderna och högen står i årsordning, och raden utan år sist", async () => {
    seeda();
    expect(await aterstar()).toEqual([
      { namn: "Listfabriken", ar: "2019" },
      { namn: "Badrummet", ar: "2023" },
      { namn: "Golvbutiken", ar: "2024" },
      { namn: "Färghandeln", ar: "2025" },
      { namn: "Fogmästarna", ar: null },
    ]);
  });
});
