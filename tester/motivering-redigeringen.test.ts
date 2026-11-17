// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fråga 8, "Hur vet du det?" (docs/design.md, "Det hör hemma i Ändra
// projektet", 2026-11-18): fältet står i projektets redigering, direkt under
// skickfrågan, när skicket vid förvärvet är 0–2 – och alltid när ett svar
// redan finns. Projektsidan visar svaret som en rad, och ingenting när det
// saknas. Ett svar skrivet med det gamla fältet tappas aldrig.

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
import { MOTIVERING_ETIKETT } from "@/app/projekt/fragetradet";
import ProjektSida from "@/app/projekt/[id]/page";
import RedigeraSida from "@/app/projekt/[id]/redigera/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-0000000000f1";
const X = "b0000000-0000-4000-8000-0000000000f1";
const P = "c0000000-0000-4000-8000-0000000000f1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const SVARET = "Mäklarbilden visar fläckig vägg bakom garderoben";

function seeda(projekt: { skick_forvarv: number | null; motivering: string | null; atgardstyp?: string }) {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet",
    tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  const utbytt = (projekt.atgardstyp ?? "utbytt") === "utbytt";
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Måla sovrummet", ar: 2026, atgardstyp: projekt.atgardstyp ?? "utbytt",
    battre_kvalitet: utbytt ? false : null, merkostnad: null,
    skick_forvarv: projekt.skick_forvarv, motivering: projekt.motivering,
  });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function projektsidan(): Promise<HTMLDivElement> {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup((await ProjektSida({ params: Promise.resolve({ id: P }) })) as never);
  return div;
}

/** Raderna i projektsidans del Frågorna, där motiveringen hör hemma
 *  (docs/design.md, "Projektsidan ändras i delar"), som hon läser dem:
 *  etikett | värde. Delen hittas på sin rubrik, och testet stannar om den
 *  saknas. */
function faktarader(s: HTMLElement): string[] {
  const rubrik = [...s.querySelectorAll("h2")].find((e) => e.textContent === "Frågorna");
  expect(rubrik, "delen Frågorna").toBeDefined();
  const del = rubrik!.closest("section")!;
  return [...del.querySelectorAll("div")]
    .filter((e) => e.children.length === 2 && e.children[0].tagName === "SPAN")
    .map((e) => [...e.children].map((c) => c.textContent).join(" | "));
}

/** Redigeringen renderad, med fältet hittat på sin etikett – eller null. */
async function redigeringen(): Promise<{ div: HTMLDivElement; falt: HTMLTextAreaElement | null; formular: () => FormData; stang: () => void }> {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const rot = createRoot(div);
  await act(async () => rot.render(await RedigeraSida({ params: Promise.resolve({ id: P }) })));
  const label = [...div.querySelectorAll("label")].find((l) => l.textContent?.startsWith(MOTIVERING_ETIKETT));
  return {
    div,
    falt: label?.querySelector("textarea") ?? null,
    formular: () => new FormData(div.querySelector("form")!),
    stang: () => {
      act(() => rot.unmount());
      div.remove();
    },
  };
}

async function skrivIFaltet(falt: HTMLTextAreaElement, text: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(falt, text);
    falt.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => seeda({ skick_forvarv: 1, motivering: null }));

describe("projektsidan visar, den skriver inte", () => {
  it("ett besvarat svar är en rad direkt efter Skick vid förvärvet", async () => {
    seeda({ skick_forvarv: 1, motivering: SVARET });
    const rader = faktarader(await projektsidan());
    const i = rader.indexOf("Skick vid förvärvet | 1 – Dåligt skick");
    expect(i, "skickraden").toBeGreaterThanOrEqual(0);
    expect(rader[i + 1]).toBe(`Hur vet du det? | ${SVARET}`);
  });

  it("obesvarat: ingen rad – också när skicket är ett där frågan ställs", async () => {
    const s = await projektsidan();
    // Förutsättningen: faktarutan har sina rader, skicket 1 bland dem.
    expect(faktarader(s)).toContain("Skick vid förvärvet | 1 – Dåligt skick");
    expect(s.textContent).not.toContain(MOTIVERING_ETIKETT);
  });

  it("inget fält och ingen egen Spara-knapp på sidan, vad som än är besvarat", async () => {
    for (const motivering of [null, SVARET]) {
      seeda({ skick_forvarv: 1, motivering });
      const s = await projektsidan();
      expect(s.querySelector("textarea")).toBeNull();
      expect(s.querySelector("form")).toBeNull();
    }
  });
});

describe("fältet i redigeringen", () => {
  it("skick 0–2: fältet står direkt under skickfrågan, tomt", async () => {
    for (const skick of [0, 1, 2]) {
      seeda({ skick_forvarv: skick, motivering: null });
      const r = await redigeringen();
      expect(r.falt, `skick ${skick}`).not.toBeNull();
      expect(r.falt!.value).toBe("");
      const skickfragan = [...r.div.querySelectorAll("fieldset")].find((f) =>
        f.querySelector("legend")?.textContent === "Hur var skicket vid förvärvet?",
      );
      expect(skickfragan, "skickfrågan").toBeTruthy();
      expect(skickfragan!.nextElementSibling).toBe(r.falt!.closest("label"));
      r.stang();
    }
  });

  it("skick 3 eller mer utan svar: inget fält", async () => {
    for (const skick of [3, 4, 5]) {
      seeda({ skick_forvarv: skick, motivering: null });
      const r = await redigeringen();
      expect(r.falt, `skick ${skick}`).toBeNull();
      expect(r.formular().get("motivering"), "inget gömt svar skickas").toBe("");
      r.stang();
    }
  });

  it("skriver hon ett svar och byter sedan till ett högt skick, försvinner fältet – och svaret skickas inte dolt", async () => {
    const r = await redigeringen();
    await skrivIFaltet(r.falt!, "Säljarens bilder");
    // Förutsättningen: svaret är skrivet och skulle skickas.
    expect(r.formular().get("motivering")).toBe("Säljarens bilder");
    const fyra = [...r.div.querySelectorAll("button")].find((b) => b.textContent === "4 – Nästan nytt skick")!;
    await act(async () => fyra.click());
    const label = [...r.div.querySelectorAll("label")].find((l) => l.textContent?.startsWith(MOTIVERING_ETIKETT));
    expect(label, "fältet borta vid skick 4").toBeUndefined();
    expect(r.formular().get("motivering")).toBe("");
    r.stang();
  });

  it("ett svar skrivet med det gamla fältet står förifyllt – också när skicket inte längre kräver frågan", async () => {
    for (const fall of [
      { skick_forvarv: 4, motivering: SVARET },
      { skick_forvarv: null, motivering: SVARET, atgardstyp: "nybyggnad" },
    ]) {
      seeda(fall);
      const r = await redigeringen();
      expect(r.falt, JSON.stringify(fall)).not.toBeNull();
      expect(r.falt!.value).toBe(SVARET);
      r.stang();
    }
  });
});

describe("att spara redigeringen", () => {
  it("oförändrad: svaret står kvar", async () => {
    seeda({ skick_forvarv: 4, motivering: SVARET });
    const r = await redigeringen();
    const f = r.formular();
    r.stang();
    await expect(redigeraProjekt({}, f)).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
    expect(h.db.tabell("projekt")[0].motivering).toBe(SVARET);
  });

  it("ett nytt svar sparas, och ett tömt fält stryker det", async () => {
    const r = await redigeringen();
    await skrivIFaltet(r.falt!, "  Säljarens bilder  ");
    const f = r.formular();
    r.stang();
    await expect(redigeraProjekt({}, f)).rejects.toThrow("NEXT_REDIRECT");
    expect(h.db.tabell("projekt")[0].motivering).toBe("Säljarens bilder");

    const r2 = await redigeringen();
    expect(r2.falt!.value).toBe("Säljarens bilder");
    await skrivIFaltet(r2.falt!, "");
    const f2 = r2.formular();
    r2.stang();
    await expect(redigeraProjekt({}, f2)).rejects.toThrow("NEXT_REDIRECT");
    expect(h.db.tabell("projekt")[0].motivering).toBeNull();
  });

  it("ett formulär utan fältet rör inte svaret", async () => {
    seeda({ skick_forvarv: 1, motivering: SVARET });
    const f = new FormData();
    for (const [k, v] of Object.entries({
      projekt_id: P, namn: "Måla om sovrummet", byggde_nytt: "nej", andrade_planlosning: "nej",
      nytt_eller_bytt: "bytt", battre_eller_liknande: "liknande", skick_forvarv: "1",
    })) f.set(k, v);
    await expect(redigeraProjekt({}, f)).rejects.toThrow("NEXT_REDIRECT");
    expect(h.db.tabell("projekt")[0]).toMatchObject({ namn: "Måla om sovrummet", motivering: SVARET });
  });
});
