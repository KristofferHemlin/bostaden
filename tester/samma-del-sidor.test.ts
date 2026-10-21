// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Fragan om samma del av bostaden, provad pa det som renderas och pa serverns
// svar (CLAUDE.md, "Samma byggnadsdel reparerad två gånger"). Berakningen
// sjalv ar provad i tester/samma-del.test.ts; har provas att sidorna och
// flodet foljer den – med den riktiga berakningen under, mot en falsk databas.
//
//   - Steget visas nar minst tva atgarder har reparationsunderlag kvar efter
//     steg 3, och inte annars.
//   - Det kommer efter skickfragorna.
//   - Ja visar hennes egna atgarder med artal; ett tidigare svar ar ifyllt.
//   - Ett sparat svar nollar reparationen i underlaget, med sitt skal.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/forsaljning/samma-del",
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

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { sparaSammaDel } from "@/app/forsaljning/samma-del/actions";
import { SammaDelFormular } from "@/app/forsaljning/samma-del/formular";
import SammaDelSida from "@/app/forsaljning/samma-del/page";
import SkickSida from "@/app/forsaljning/skick/page";
import ForsaljningSida from "@/app/forsaljning/page";
import ExportSida from "@/app/export/page";
import ProjektSida from "@/app/projekt/[id]/page";
import {
  SAMMA_DEL_FRAGA,
  SAMMA_DEL_MARKERA,
  SAMMA_DEL_OBESVARAD,
  SAMMA_DEL_SKAL,
} from "@/doman/samma-del";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const FASAD = "c0000000-0000-4000-8000-000000000001";
const FASAD_IGEN = "c0000000-0000-4000-8000-000000000002";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda({ forstaBetald = "2022-06-01" }: { forstaBetald?: string } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2015-06-01"),
    bostadsfragor_besvarade: true,
    forsta_agare: false,
    forsaljningsdatum: datum("2026-09-15"),
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100, bekraftad_andel: 100 });
  reparation(FASAD, "Måla fasaden", 2022, forstaBetald, 3_000_000);
  reparation(FASAD_IGEN, "Måla fasaden igen", 2025, "2025-06-01", 4_000_000);
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** En reparation – utbytt, liknande kvalitet, skicket besvarat 1 -> 4. */
function reparation(id: string, namn: string, ar: number, betald: string, belopp: number) {
  h.db.lagg("projekt", {
    id,
    bostad_id: X,
    namn,
    ar,
    atgardstyp: "utbytt",
    battre_kvalitet: false,
    skick_forvarv: 1,
    skick_forsaljning: 4,
  });
  const k = h.db.lagg("kostnad", {
    bostad_id: X,
    leverantor: "Målerifirman",
    totalbelopp: belopp,
    dokumentdatum: datum(betald),
    betaldatum: datum(betald),
  });
  const rad = h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Målning", belopp });
  h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: id, andel: 1 });
}

function fd(varden: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(varden)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

async function omdirigeringFran(anrop: () => Promise<unknown>): Promise<string | null> {
  try {
    await anrop();
    return null;
  } catch (e) {
    if (e instanceof h.Omdirigering) return e.url;
    throw e;
  }
}

function elementFor(nod: unknown, namn: string): ReactElement<Record<string, unknown>>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<Record<string, unknown>> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

/** Renderad HTML som DOM, sa att text provas mot hela element. */
function dom(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

/** Element av en viss sort vars HELA text ar exakt den har – aldrig en delstrang. */
function medText(rot: ParentNode, tagg: string, text: string): Element[] {
  return [...rot.querySelectorAll(tagg)].filter((e) => e.textContent?.trim() === text);
}

const projekt = (id: string) => h.db.tabell("projekt").find((p) => p.id === id)!;
const bostaden = () => h.db.tabell("bostad").find((b) => b.id === X)!;

beforeEach(() => seeda());

describe("när steget visas", () => {
  it("två åtgärder med reparationsunderlag: sidan ställer frågan", async () => {
    const vy = await SammaDelSida();
    const [formular] = elementFor(vy, "SammaDelFormular");
    expect(formular, "sidan visar inte fragan").toBeTruthy();
    const html = dom(renderToStaticMarkup(formular));
    expect(medText(html, "legend", SAMMA_DEL_FRAGA)).toHaveLength(1);
  });

  it("den ena utanför femårsfönstret: steget visas inte, sidan går till underlaget", async () => {
    seeda({ forstaBetald: "2019-06-01" });
    expect(await omdirigeringFran(() => SammaDelSida())).toBe("/export");
  });
});

describe("steget kommer efter skickfrågorna", () => {
  it("när alla skick är bedömda leder skickfrågorna till frågan", async () => {
    expect(await omdirigeringFran(() => SkickSida())).toBe("/forsaljning/samma-del");
  });

  it("utan fråga att ställa stannar skickfrågorna på sitt eget slut", async () => {
    seeda({ forstaBetald: "2019-06-01" });
    expect(await omdirigeringFran(() => SkickSida())).toBeNull();
  });
});

describe("att svara", () => {
  it("ja med den tidigare markerad: markeringen och kandidaterna sparas", async () => {
    const till = await omdirigeringFran(() =>
      sparaSammaDel({}, fd({ svar: "ja", markerad: [FASAD] })),
    );
    expect(till).toBe("/export");
    expect(projekt(FASAD).tidigare_gang_samma_del).toBe(true);
    expect(projekt(FASAD_IGEN).tidigare_gang_samma_del).toBeNull();
    expect([...(bostaden().samma_del_besvarad_for as string[])].sort()).toEqual(
      [FASAD, FASAD_IGEN].sort(),
    );
    // Ett svar som klassificeringen – "Besvarat av".
    expect(projekt(FASAD).klassificerad_av).toBe(ANNA);
  });

  it("båda markerade avvisas – ingenting sparas", async () => {
    const svar = await sparaSammaDel({}, fd({ svar: "ja", markerad: [FASAD, FASAD_IGEN] }));
    expect(svar).toEqual({ fel: "Den senaste gången lämnar du omarkerad." });
    expect(projekt(FASAD).tidigare_gang_samma_del).toBeNull();
    expect(bostaden().samma_del_besvarad_for).toEqual([]);
  });

  it("nej efter ja tar bort markeringen", async () => {
    await omdirigeringFran(() => sparaSammaDel({}, fd({ svar: "ja", markerad: [FASAD] })));
    await omdirigeringFran(() => sparaSammaDel({}, fd({ svar: "nej" })));
    expect(projekt(FASAD).tidigare_gang_samma_del).toBeNull();
  });
});

describe("i underlaget", () => {
  async function sida2(): Promise<HTMLElement> {
    const vy = await ExportSida();
    return dom(elementFor(vy, "Kort").map((k) => renderToStaticMarkup(k)).join("\n"));
  }

  it("ett sparat ja ger den markerade nollan sitt skäl", async () => {
    expect(medText(await sida2(), "*", SAMMA_DEL_SKAL)).toHaveLength(0);
    await omdirigeringFran(() => sparaSammaDel({}, fd({ svar: "ja", markerad: [FASAD] })));
    expect(medText(await sida2(), "*", SAMMA_DEL_SKAL).length).toBeGreaterThan(0);
  });

  it("en överhoppad fråga står under Att se över", async () => {
    expect(medText(await sida2(), "p", SAMMA_DEL_OBESVARAD)).toHaveLength(1);
    await omdirigeringFran(() => sparaSammaDel({}, fd({ svar: "nej" })));
    expect(medText(await sida2(), "p", SAMMA_DEL_OBESVARAD)).toHaveLength(0);
  });
});

describe("projektsidan visar markeringen där talet står", () => {
  async function innehall(id: string): Promise<HTMLElement> {
    const vy = await ProjektSida({ params: Promise.resolve({ id }) });
    const [skarm] = elementFor(vy, "Skarm");
    return dom(renderToStaticMarkup(createElement("div", null, skarm.props.children as never)));
  }
  /** Radens varde, for etiketten – hela texten, aldrig en delstrang. */
  function radvarde(rot: HTMLElement, etikett: string): string[] {
    return medText(rot, "span", etikett).map((e) => e.nextElementSibling?.textContent?.trim() ?? "");
  }

  beforeEach(async () => {
    await omdirigeringFran(() => sparaSammaDel({}, fd({ svar: "ja", markerad: [FASAD] })));
  });

  it("ett markerat projekt har raden, skälet och vägen ut", async () => {
    const rot = await innehall(FASAD);
    expect(radvarde(rot, "Samma del av bostaden")).toEqual(["Gjordes om senare"]);
    const [skal] = medText(rot, "p", `${SAMMA_DEL_SKAL} Ändra svaret`);
    expect(skal, "skalet med lanken").toBeTruthy();
    expect(medText(skal, "a", "Ändra svaret")[0].getAttribute("href")).toBe(
      "/forsaljning/samma-del",
    );
  });

  it("ett omarkerat projekt har ingen sådan rad", async () => {
    const rot = await innehall(FASAD_IGEN);
    expect(radvarde(rot, "Samma del av bostaden")).toEqual([]);
    expect(rot.textContent).not.toContain(SAMMA_DEL_SKAL);
    // Men skickraden finns – raden ovan hor till samma block.
    expect(radvarde(rot, "Skick vid försäljningen")).toEqual(["4 – Nästan nytt skickÄndra"]);
  });
});

describe("Försäljningsuppgifter lovar bara det som går", () => {
  async function meddelande(): Promise<string> {
    const vy = await ForsaljningSida();
    const [ruta] = elementFor(vy, "Meddelanderuta");
    return dom(renderToStaticMarkup(ruta)).textContent!.trim();
  }

  it("med frågan: datum, pris och svaret om samma del", async () => {
    expect(await meddelande()).toBe(
      "Bostaden är markerad som såld. Här ändrar du datum och pris, och därefter ditt svar om samma del av bostaden gjorts om.",
    );
  });

  it("utan frågan: bara datum och pris – aldrig bedömningen per reparation", async () => {
    seeda({ forstaBetald: "2019-06-01" });
    expect(await meddelande()).toBe("Bostaden är markerad som såld. Här ändrar du datum och pris.");
  });
});

describe("formuläret", () => {
  let behallare: HTMLDivElement;
  let rot: Root;
  beforeEach(() => {
    behallare = document.createElement("div");
    document.body.appendChild(behallare);
    rot = createRoot(behallare);
  });
  afterEach(() => {
    act(() => rot.unmount());
    behallare.remove();
  });

  const kandidater = [
    { id: FASAD, namn: "Måla fasaden", ar: 2022, markerad: false },
    { id: FASAD_IGEN, namn: "Måla fasaden igen", ar: 2025, markerad: false },
  ];
  const knapp = (text: string) => medText(behallare, "button", text)[0] as HTMLButtonElement;
  const markerade = () =>
    [...behallare.querySelectorAll<HTMLInputElement>('input[name="markerad"]')].map((i) => i.value);

  it("ja visar hennes åtgärder med årtal, och en markering följer med formuläret", async () => {
    await act(async () =>
      rot.render(createElement(SammaDelFormular, { kandidater, besvarad: false, andrad: false })),
    );
    expect(medText(behallare, "legend", SAMMA_DEL_MARKERA)).toHaveLength(0);
    await act(async () => knapp("Ja").click());
    expect(medText(behallare, "legend", SAMMA_DEL_MARKERA)).toHaveLength(1);
    expect(knapp("2022 · Måla fasaden")).toBeTruthy();
    expect(knapp("2025 · Måla fasaden igen")).toBeTruthy();

    await act(async () => knapp("2022 · Måla fasaden").click());
    expect(markerade()).toEqual([FASAD]);
    expect(knapp("2022 · Måla fasaden").getAttribute("aria-pressed")).toBe("true");
  });

  it("ett tidigare ja är ifyllt med sina markeringar", async () => {
    await act(async () =>
      rot.render(
        createElement(SammaDelFormular, {
          kandidater: [{ ...kandidater[0], markerad: true }, kandidater[1]],
          besvarad: true,
          andrad: false,
        }),
      ),
    );
    expect(knapp("Ja").getAttribute("aria-pressed")).toBe("true");
    expect(markerade()).toEqual([FASAD]);
  });

  it("ett tidigare nej är ifyllt", async () => {
    await act(async () =>
      rot.render(createElement(SammaDelFormular, { kandidater, besvarad: true, andrad: false })),
    );
    expect(knapp("Nej").getAttribute("aria-pressed")).toBe("true");
    expect(markerade()).toEqual([]);
  });
});
