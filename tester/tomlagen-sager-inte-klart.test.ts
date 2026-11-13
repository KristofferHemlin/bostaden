// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// docs/design.md, "Ett tomt tillstånd får bara säga 'klart' om helheten är
// klar". En skärm som bara ser en del av arbetet ska formulera sig om sin del,
// aldrig om alltihop. Regeln vaktades till 2026-11-13 av fas 1:s och fas 2:s
// tomlägen, som revs med genomgången; design.md namnger de tre levande
// skärmar som kan bryta den, och här är ett prov per skärm.
//
// Varje prov visar först båda förutsättningarna: skärmens egen del är klar,
// och resten av arbetet är det inte. Annars kunde skärmen ha rätt att säga
// klart, och provet säger ingenting.

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
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://x/y" }, error: null })),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import KvittolistaSida from "@/app/kostnad/page";
import ProjektlistaSida from "@/app/projekt/page";
import ExportSida from "@/app/export/page";
import { behoverSkickForsaljning } from "@/doman/fragetradet";
import { formateraKronor } from "@/lib/format";

const ANNA = "a0000000-0000-4000-8000-000000000041";
const X = "b0000000-0000-4000-8000-000000000041";
const P = "c0000000-0000-4000-8000-000000000041";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Ett påstående om att allt är gjort – i vilken form det än skrivs. */
const KLART = /\b(klart|klar|färdig|färdigt|allt är (gjort|besvarat|berättat)|inget (kvar|mer|återstår|väntar)|berättat om allt)\b/i;

function seeda({ sald = false, projekt = "utbytt" as "utbytt" | "nybyggnad", friaKvitton = 0 } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "bostadsratt", tilltradesdatum: datum("2021-03-01"),
    nybyggd_vid_forvarv: false, ...(sald ? { forsaljningsdatum: datum("2026-09-01") } : {}),
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100, bekraftad_andel: 100 });
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: projekt === "utbytt" ? "Nya fönster" : "Ny altan", ar: 2025, atgardstyp: projekt,
    battre_kvalitet: projekt === "utbytt" ? false : null, skick_forvarv: projekt === "utbytt" ? 1 : null,
    skick_forsaljning: null, klassificerad_av: ANNA,
  });
  const k = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Byggmax", anteckning: "Material", totalbelopp: 900_000,
    dokumentdatum: datum("2025-05-02"), betaldatum: datum("2025-05-02"), skapad_at: datum("2026-01-01"),
  });
  const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 900_000 });
  db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: P, andel: 1 });
  for (let i = 0; i < friaKvitton; i++) {
    const f = db.lagg("kostnad", {
      bostad_id: X, leverantor: "Colorama", anteckning: `Färg ${i + 1}`, totalbelopp: 50_000,
      dokumentdatum: datum("2025-08-01"), betaldatum: datum("2025-08-01"), skapad_at: datum(`2026-01-0${i + 2}`),
    });
    db.lagg("kostnadsrad", { kostnad_id: f.id, artikel: "Färg", belopp: 50_000 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/**
 * Sidans text, nod för nod med mellanrum emellan. textContent fogar ihop
 * intilliggande element utan mellanrum – "Allt är klart" intill "Lägg till
 * kvitto" blir "klartLägg", och då hittar ordgränsen i mönstret ingenting.
 * Upptäckt 2026-11-13 när en brytning med flit inte föll.
 */
function lasbarText(rot: Node): string {
  const delar: string[] = [];
  const gang = document.createTreeWalker(rot, NodeFilter.SHOW_TEXT);
  for (let n = gang.nextNode(); n; n = gang.nextNode()) delar.push(n.textContent ?? "");
  return delar.join(" ");
}

async function sida(vy: unknown): Promise<HTMLElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup((await vy) as Parameters<typeof renderToStaticMarkup>[0]);
  return div.querySelector("main")!;
}

describe("en skärm som ser en del av arbetet säger aldrig att allt är klart", () => {
  it("kvittolistan, när varje kvitto hör till ett projekt men ett projekt väntar på försäljningsfrågorna", async () => {
    seeda({ sald: true });
    // Förutsättningarna: kvittolistans del är klar – inget kvitto utan projekt,
    // inget kort – och ett projekt väntar på skicket vid försäljningen.
    expect(h.db.tabell("projekt").filter((p) => behoverSkickForsaljning(p as never))).toHaveLength(1);
    const s = await sida(KvittolistaSida());
    expect(s.textContent).not.toMatch(/kvitton utan projekt/);
    expect(lasbarText(s)).not.toMatch(KLART);
  });

  it("projektlistan, när varje projekt är besvarat men kvitton står utan projekt", async () => {
    seeda({ friaKvitton: 2 });
    const s = await sida(ProjektlistaSida());
    // Förutsättningarna: inget projekt väntar på frågor, och två kvitton har inget projekt.
    expect(s.textContent).not.toContain("Väntar på frågor");
    expect(h.db.tabell("radfordelning")).toHaveLength(1);
    expect(h.db.tabell("kostnad")).toHaveLength(3);
    expect(lasbarText(s)).not.toMatch(KLART);
  });

  it("underlaget, när sida 1 är komplett men Återstår inte är tom – och summan är dämpad", async () => {
    seeda({ projekt: "nybyggnad", friaKvitton: 2 });
    const s = await sida(ExportSida());
    // Förutsättningarna: sida 1 har sin rad med belopp och avdragsgill del,
    // och Återstår har kvitton.
    const rader = [...s.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent));
    expect(rader).toEqual([["Ny altan", "2025", formateraKronor(900_000), formateraKronor(900_000)]]);
    expect([...s.querySelectorAll("p")].some((p) => p.textContent === "Återstår")).toBe(true);
    expect(lasbarText(s)).not.toMatch(KLART);
    const summa = [...s.querySelectorAll("section")].find((e) => e.textContent?.startsWith("Förs till"))!;
    expect(summa.querySelector(".font-rubrik")!.className, "summan ska dämpas när något återstår").toContain("text-text-sekundar");
  });

  it("förutsättningen för mönstret: det känner igen ett påstående om att allt är klart", () => {
    for (const t of ["Allt är klart", "Du har berättat om allt du lagt in", "Inget väntar på frågor", "Inget mer att bedöma", "Allt är besvarat"]) {
      expect(t, t).toMatch(KLART);
    }
    expect("Hör inte till något projekt än").not.toMatch(KLART);
    // Och läsningen bevarar ordgränsen mellan två intilliggande element.
    const div = document.createElement("div");
    div.innerHTML = "<p>Allt är klart</p><a>Lägg till kvitto</a>";
    expect(div.textContent, "förutsättningen: textContent fogar ihop orden").toContain("klartLägg");
    expect(lasbarText(div)).toMatch(KLART);
  });
});
