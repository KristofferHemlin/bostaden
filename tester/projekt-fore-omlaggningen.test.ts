// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Projekt som skapades före omläggningen (docs/design.md, under
// Projektlistan): atgardstyp null, ofta utan namn, med kvitton. Ett sådant
// finns i produktionen och rörs inte där – gränssnittet ska klara det, utan
// /genomgang/fragor:
//
//   * projektsidans Svara på frågorna och underlagets Återstår leder till
//     redigeringen
//   * redigeringen heter Berätta vad du gjort när svaret saknas
//   * ett tomt namn visas som kvittona, aldrig rakt av
//   * årsetiketten sätts till tidigaste betaldatum när svaren ges
//   * Väntar på frågor står kvar i projektlistan

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return { db: skapaFalskDatabas(), Omdirigering, inloggad: null as { id: string; email: string } | null };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/projekt",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
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

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { redigeraProjekt } from "@/app/projekt/actions";
import ProjektSida from "@/app/projekt/[id]/page";
import RedigeraSida from "@/app/projekt/[id]/redigera/page";
import ProjektlistaSida from "@/app/projekt/page";
import ExportSida from "@/app/export/page";

const ANNA = "a0000000-0000-4000-8000-000000000081";
const X = "b0000000-0000-4000-8000-000000000081";
const HOG = "c0000000-0000-4000-8000-000000000081";
const KLAR = "c0000000-0000-4000-8000-000000000082";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const design = () => readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

/** Rubrikerna ur design.md: utan svar, med svar. */
function rubrikerna(): { utan: string; med: string } {
  const m = design().match(/inget svar heter sidan \*\*"([^"]+)"\*\*; har det ett heter den \*\*"([^"]+)"\*\*/);
  if (!m) throw new Error("design.md saknar redigeringens två rubriker");
  return { utan: m[1], med: m[2] };
}

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // Som raden i produktionen: inget namn, inga svar, kvitton. Etiketten 2026
  // är fel med flit – kvittona är betalda 2024 och 2025.
  db.lagg("projekt", { id: HOG, bostad_id: X, namn: "", ar: 2026, atgardstyp: null });
  db.lagg("projekt", {
    id: KLAR, bostad_id: X, namn: "Ny altan", ar: 2026, atgardstyp: "nybyggnad",
  });
  for (const [leverantor, dag, projekt] of [
    ["BAUHAUS", "2024-11-02", HOG],
    ["Byggmax", "2025-02-10", HOG],
    ["Byggmax", "2025-03-01", KLAR],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor, totalbelopp: 600_000, dokumentdatum: datum(dag), betaldatum: datum(dag),
    });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 600_000 });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: projekt, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function dom(vy: unknown): Promise<HTMLDivElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup((await vy) as Parameters<typeof renderToStaticMarkup>[0]);
  return div;
}

const lankar = (div: HTMLElement, text: string) =>
  [...div.querySelectorAll("a")].filter((a) => a.textContent === text).map((a) => a.getAttribute("href"));

const NAMNET = "2 kvitton · BAUHAUS, Byggmax";

beforeEach(() => seeda());

describe("projektsidan", () => {
  it("heter som sina kvitton, och Svara på frågorna leder till redigeringen", async () => {
    const s = await dom(ProjektSida({ params: Promise.resolve({ id: HOG }) }));
    expect([...s.querySelectorAll("h1")].map((x) => x.textContent)).toEqual([NAMNET]);
    expect(lankar(s, "Svara på frågorna")).toEqual([`/projekt/${HOG}/redigera`]);
    expect(s.innerHTML).not.toContain("/genomgang");
    expect(lankar(s, "Ändra projektet"), "inget svar att ändra").toEqual([]);
  });

  it("ett besvarat projekt har ingen Svara på frågorna, men Ändra projektet", async () => {
    const s = await dom(ProjektSida({ params: Promise.resolve({ id: KLAR }) }));
    expect(lankar(s, "Svara på frågorna")).toEqual([]);
    expect(lankar(s, "Ändra projektet")).toEqual([`/projekt/${KLAR}/redigera`]);
  });
});

describe("redigeringen", () => {
  async function rendera(id: string): Promise<HTMLDivElement> {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const rot = createRoot(div);
    await act(async () => rot.render(await RedigeraSida({ params: Promise.resolve({ id }) })));
    const kopia = div.cloneNode(true) as HTMLDivElement;
    act(() => rot.unmount());
    div.remove();
    return kopia;
  }

  it("heter Berätta vad du gjort när svaret saknas, och bakåt heter som kvittona", async () => {
    const s = await rendera(HOG);
    expect([...s.querySelectorAll("h1")].map((x) => x.textContent)).toEqual([rubrikerna().utan]);
    expect(lankar(s, `← ${NAMNET}`).concat(lankar(s, NAMNET))).toEqual([`/projekt/${HOG}`]);
  });

  it("heter Ändra projekt när svaret finns", async () => {
    const s = await rendera(KLAR);
    expect([...s.querySelectorAll("h1")].map((x) => x.textContent)).toEqual([rubrikerna().med]);
  });

  function svar(id: string, namn: string): FormData {
    const f = new FormData();
    f.set("projekt_id", id);
    f.set("namn", namn);
    f.set("byggde_nytt", "ja");
    return f;
  }

  it("när svaren ges sätts årsetiketten till tidigaste betaldatum", async () => {
    await expect(redigeraProjekt({}, svar(HOG, "Nytt förråd"))).rejects.toThrow(`NEXT_REDIRECT /projekt/${HOG}`);
    expect(h.db.tabell("projekt").find((p) => p.id === HOG)).toMatchObject({
      namn: "Nytt förråd", atgardstyp: "nybyggnad", ar: 2024,
    });
  });

  it("ett projekt som redan har svar behåller sin etikett", async () => {
    await expect(redigeraProjekt({}, svar(KLAR, "Ny altan"))).rejects.toThrow("NEXT_REDIRECT");
    expect(h.db.tabell("projekt").find((p) => p.id === KLAR)!.ar).toBe(2026);
  });
});

describe("listan och underlaget", () => {
  it("projektlistan visar Väntar på frågor för det gamla projektet, och bara för det", async () => {
    const s = await dom(ProjektlistaSida());
    const rad = (namn: string) =>
      [...s.querySelectorAll("a")].find((a) => a.textContent?.startsWith(namn))?.closest("div")?.textContent ?? "";
    expect(rad(NAMNET)).toContain("Väntar på frågor");
    expect(rad("Ny altan")).not.toContain("Väntar på frågor");
  });

  it("underlagets Återstår leder från det gamla projektet till redigeringen", async () => {
    const s = await dom(ExportSida());
    // En rad per år, som allt i underlaget: kvittona är betalda 2024 och 2025.
    expect(lankar(s, NAMNET)).toEqual([`/projekt/${HOG}/redigera`, `/projekt/${HOG}/redigera`]);
    expect(s.innerHTML).not.toContain('href="/genomgang');
  });
});
