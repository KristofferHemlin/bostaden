// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// "Hör inte till bostaden" på kvittots sida (docs/design.md, "Ett kvitto är en
// skärm, inte två"): direkt under privatfältet i ändringsläget, aldrig i
// läsläget, och alltid vändbar med samma kontroll. Fas 1 i genomgången var till
// 2026-11-13 det enda stället markeringen gick att sätta.
//
// Den tar inte bort något: bilagan och beloppet ligger kvar. En koppling till
// ett projekt lossas, som i fas 1; privata rader rörs inte.

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
  usePathname: () => "/kostnad",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
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
  bilagelager: () => ({
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://x/y" }, error: null })),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { sattHorInteTillBostaden } from "@/app/kostnad/[id]/actions";
import KostnadSida from "@/app/kostnad/[id]/page";
import KvittolistaSida from "@/app/kostnad/page";
import { hamtaValbaraKvitton } from "@/lib/valbara-kvitton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {};

const ANNA = "a0000000-0000-4000-8000-000000000071";
const X = "b0000000-0000-4000-8000-000000000071";
const Y = "b0000000-0000-4000-8000-000000000072";
const P = "c0000000-0000-4000-8000-000000000071";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

let kvitto = "";
let annans = "";

function seeda({ arkiverad = false } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  for (const id of [X, Y]) {
    db.lagg("bostad", { id, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"), nybyggd_vid_forvarv: false });
  }
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Måla sovrummet", ar: 2026, atgardstyp: "utbytt", battre_kvalitet: false, skick_forvarv: 2 });
  // Bauhaus-kvittot (produktspec 11): målningsmaterial och ett privat torkställ.
  const k = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Bauhaus Bromma", anteckning: "Färg och penslar till sovrummet",
    totalbelopp: 102_095, dokumentdatum: datum("2026-08-22"), betaldatum: datum("2026-08-22"), arkiverad, skapad_av: ANNA,
  });
  kvitto = k.id as string;
  db.lagg("bilaga", {
    kostnad_id: k.id, lagringsnyckel: `x/${k.id}.jpg`, filnamn: "kvitto.jpg", mimetyp: "image/jpeg",
    storlek: 120_000, uppladdning_bekraftad: true,
  });
  const farg = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "LIVING VÄGGFÄRG HE", belopp: 79_195 });
  if (!arkiverad) db.lagg("radfordelning", { kostnadsrad_id: farg.id, projekt_id: P, andel: 1 });
  const tork = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "TORKSTATIV SUSSI BLA", belopp: 22_900 });
  db.lagg("radfordelning", { kostnadsrad_id: tork.id, projekt_id: null, privat: true, andel: 1 });
  const a = db.lagg("kostnad", {
    bostad_id: Y, leverantor: "Byggmax", totalbelopp: 50_000, dokumentdatum: datum("2026-01-01"), betaldatum: datum("2026-01-01"),
  });
  annans = a.id as string;
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

const kostnaden = () => h.db.tabell("kostnad").find((k) => k.id === kvitto)!;
const fordelningar = () => {
  const rader = new Set(h.db.tabell("kostnadsrad").filter((r) => r.kostnad_id === kvitto).map((r) => r.id));
  return h.db.tabell("radfordelning").filter((f) => rader.has(f.kostnadsrad_id));
};

beforeEach(() => seeda());

describe("markeringen", () => {
  it("sätter kvittot utanför bostaden, lossar projektet och rör inget annat", async () => {
    const bilagorFore = h.db.tabell("bilaga").length;
    expect(await sattHorInteTillBostaden(kvitto, true)).toEqual({});
    expect(kostnaden()).toMatchObject({ arkiverad: true, totalbelopp: 102_095 });
    expect(fordelningar()).toMatchObject([{ projekt_id: null, privat: true }]);
    expect(h.db.tabell("bilaga")).toHaveLength(bilagorFore);
  });

  it("samma kontroll för tillbaka kvittot – utan projekt, och det går att välja till ett igen", async () => {
    await sattHorInteTillBostaden(kvitto, true);
    expect((await hamtaValbaraKvitton(X)).map((k) => k.id), "markerat är inte valbart").toEqual([]);
    expect(await sattHorInteTillBostaden(kvitto, false)).toEqual({});
    expect(kostnaden().arkiverad).toBe(false);
    expect((await hamtaValbaraKvitton(X)).map((k) => k.id)).toEqual([kvitto]);
  });

  it("en annan bostads kvitto går inte att markera", async () => {
    expect(await sattHorInteTillBostaden(annans, true)).toEqual({ fel: "Kvittot hittades inte." });
    expect(h.db.tabell("kostnad").find((k) => k.id === annans)!.arkiverad).toBe(false);
  });

  it("kvittolistan visar tillståndet", async () => {
    await sattHorInteTillBostaden(kvitto, true);
    const div = document.createElement("div");
    div.innerHTML = renderToStaticMarkup(await KvittolistaSida());
    const rad = [...div.querySelectorAll("a")].find((a) => a.getAttribute("href") === `/kostnad/${kvitto}`);
    expect(rad?.textContent).toContain("Hör inte till bostaden");
  });
});

describe("var kontrollen står", () => {
  async function kvittosidan(): Promise<{ div: HTMLDivElement; andra: () => Promise<void>; stang: () => void }> {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const rot = createRoot(div);
    await act(async () => rot.render(await KostnadSida({ params: Promise.resolve({ id: kvitto }) })));
    return {
      div,
      andra: async () => {
        const knapp = [...div.querySelectorAll("button")].find((b) => b.textContent === "Ändra")!;
        await act(async () => knapp.click());
      },
      stang: () => {
        act(() => rot.unmount());
        div.remove();
      },
    };
  }

  const kontrollen = (div: HTMLElement) =>
    [...div.querySelectorAll("button")].filter((b) => b.textContent === "Hör inte till bostaden" || b.textContent === "Hör till bostaden ändå");

  it("aldrig i läsläget, och i ändringsläget direkt under privatfältet", async () => {
    const s = await kvittosidan();
    expect(kontrollen(s.div), "läsläget").toEqual([]);
    await s.andra();
    const [knapp] = kontrollen(s.div);
    expect(knapp?.textContent).toBe("Hör inte till bostaden");
    // Elementet närmast före kontrollens block är privatfältet – frågan om delen.
    const block = knapp.closest("[data-hor-inte-till-bostaden]")!;
    const fore = block.previousElementSibling!;
    expect(fore.textContent).toContain("Var något på kvittot privat?");
    expect(fore.querySelector('input[name="privatbelopp"]')).not.toBeNull();
    s.stang();
  });

  // Läsläget på ett markerat kvitto har sin befintliga väg tillbaka – och
  // bara den, inte kontrollen också.
  it("läsläget på ett markerat kvitto har en väg tillbaka, inte två", async () => {
    seeda({ arkiverad: true });
    const s = await kvittosidan();
    expect(kontrollen(s.div).map((b) => b.textContent)).toEqual(["Hör till bostaden ändå"]);
    expect(s.div.querySelector("[data-hor-inte-till-bostaden]"), "kontrollen hör till ändringsläget").toBeNull();
    s.stang();
  });

  it("på ett markerat kvitto heter samma kontroll Hör till bostaden ändå", async () => {
    seeda({ arkiverad: true });
    const s = await kvittosidan();
    await s.andra();
    expect(kontrollen(s.div).map((b) => b.textContent)).toEqual(["Hör till bostaden ändå"]);
    s.stang();
  });
});
