// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Projektlistans rad (docs/design.md, Projektlistan):
//
//   * Ett projekt utan kvitton visar inget belopp, och aldrig "0 kr" – noll
//     kronor är ett mätt tal och påstår att åtgärden inte kostade något. I
//     beloppets plats står en dämpad "Inga kvitton än".
//   * Året i raden härleds ur kvittona när det finns betalda: det tidigaste
//     betaldatumet. Den lagrade etiketten ar gäller bara utan dem.

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
  usePathname: () => "/projekt",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import ProjektlistaSida from "@/app/projekt/page";
import { formateraKronor } from "@/lib/format";

const ANNA = "a0000000-0000-4000-8000-000000000031";
const X = "b0000000-0000-4000-8000-000000000031";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "bostadsratt",
    tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // Utan kvitton, etiketten 2022.
  db.lagg("projekt", { bostad_id: X, namn: "Badrum 2022", ar: 2022, atgardstyp: "nybyggnad", skapad_at: datum("2026-01-01") });
  // Etiketten säger 2026, kvittona är betalda 2024 och 2025 – som det gamla
  // projektet i produktionen.
  const ett = db.lagg("projekt", { bostad_id: X, namn: "Nytt kök", ar: 2026, atgardstyp: "nybyggnad", skapad_at: datum("2026-01-02") });
  // Bara ett obetalt kvitto: inget betaldatum att härleda året ur.
  const obetalt = db.lagg("projekt", { bostad_id: X, namn: "Nya fönster", ar: 2023, atgardstyp: "nybyggnad", skapad_at: datum("2026-01-03") });
  for (const [projekt, belopp, betald, skapad] of [
    [ett.id, 600_000, "2025-03-01", "2026-01-04"],
    [ett.id, 400_000, "2024-11-20", "2026-01-05"],
    [obetalt.id, 900_000, null, "2026-01-06"],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Byggmax", totalbelopp: belopp,
      dokumentdatum: datum(betald ?? "2026-07-01"), betaldatum: betald ? datum(betald) : null, skapad_at: datum(skapad),
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projekt, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function listan(): Promise<HTMLElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup(await ProjektlistaSida());
  return div.querySelector("main")!;
}

/** Projektets rad – länken med projektets namn – och året den står under. */
function raden(s: HTMLElement, namn: string): { text: string; ar: string; saknas: Element | null } {
  const lank = [...s.querySelectorAll("a")].find((a) => a.textContent?.startsWith(namn));
  if (!lank) throw new Error(`projektlistan saknar ${namn}`);
  // Hela raden – en utsträckt länk: namnet är länken, beloppet står bredvid.
  const rad = lank.closest("div.relative");
  const grupp = lank.closest("div.border-b");
  if (!rad || !grupp) throw new Error(`${namn}: raden eller årsgruppen hittades inte`);
  const ar = grupp.querySelector("p")?.textContent ?? "";
  const saknas = [...rad.querySelectorAll("span")].find((e) => e.textContent === "Inga kvitton än") ?? null;
  return { text: rad.textContent ?? "", ar, saknas };
}

beforeEach(() => {
  vi.clearAllMocks();
  seeda();
});

describe("ett projekt utan kvitton", () => {
  it("visar Inga kvitton än, dämpad, och aldrig 0 kr", async () => {
    const r = raden(await listan(), "Badrum 2022");
    expect(r.saknas, "texten i beloppets plats").not.toBeNull();
    expect(r.saknas!.className).toContain("text-text-sekundar");
    expect(r.text).not.toContain(formateraKronor(0));
  });

  it("ett projekt med kvitton visar sitt belopp, och inte texten", async () => {
    const r = raden(await listan(), "Nytt kök");
    expect(r.text).toContain(formateraKronor(1_000_000));
    expect(r.saknas).toBeNull();
  });
});

describe("året i raden", () => {
  it("är det tidigaste betaldatumet bland kvittona, inte etiketten", async () => {
    // Förutsättningen: etiketten och kvittona säger olika.
    expect(h.db.tabell("projekt").find((p) => p.namn === "Nytt kök")!.ar).toBe(2026);
    expect(raden(await listan(), "Nytt kök").ar).toBe("2024");
  });

  it("är etiketten när projektet saknar kvitton, eller bara har obetalda", async () => {
    const s = await listan();
    expect(raden(s, "Badrum 2022").ar).toBe("2022");
    expect(raden(s, "Nya fönster").ar).toBe("2023");
  });
});
