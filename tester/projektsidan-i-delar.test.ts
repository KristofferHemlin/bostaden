// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Projektsidan ändras i delar (docs/design.md, "Projektsidan ändras i delar",
// 2026-11-19): en läsvy med tre delar – Vad och var, Frågorna, Kvittona – var
// och en med sin egen Ändra, som leder till en kort skärm med bara sin del.
// Räknas som är ingen del och har ingen Ändra. Att lyfta ut ett kvitto hör
// till Kvittona: kvittot lossas, det raderas inte, och raden säger vart det
// tar vägen.
//
// Varje del sparar bara sina egna fält. Det är tillståndet mellan två delar
// (CLAUDE.md, "Tillståndet mellan två steg"): när en del är ändrad och de
// andra inte är det ska de andra stå som förut – på sidan och i databasen.

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
import { lyftUtKvitto, redigeraProjekt, sparaVadOchVar } from "@/app/projekt/actions";
import ProjektSida from "@/app/projekt/[id]/page";
import RedigeraSida from "@/app/projekt/[id]/redigera/page";
import VadOchVarSida from "@/app/projekt/[id]/vad-och-var/page";
import KvittonaSida from "@/app/projekt/[id]/kvitton/andra/page";
import ValjSida from "@/app/projekt/[id]/kvitton/page";
import { laggTillKvitton } from "@/app/projekt/[id]/kvitton/actions";
import { merkostnadBehoverBekraftas } from "@/doman/atgardsberakning";
import { BOSTADSDEL_FRAGA } from "@/doman/bostadsdel";
import { merkostnadUpplysning } from "@/doman/regeltext";
import { hamtaProjektetsBelopp, tillDomanProjekt } from "@/lib/doman-fran-db";
import { hamtaValbaraKvitton } from "@/lib/valbara-kvitton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-0000000000e7";
const X = "b0000000-0000-4000-8000-0000000000e7";
const P = "c0000000-0000-4000-8000-0000000000e7"; // fönsterbytet
const Q = "c0000000-0000-4000-8000-0000000000e8"; // ett annat projekt
const GAMMALT = "c0000000-0000-4000-8000-0000000000e9"; // utan svar, utan namn
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const SVARET = "Mäklarbilden visar rutten karm";

let fonster = "";
let montage = "";
let delat = "";

function seeda() {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet",
    tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // Bytte fönster, bättre kvalitet: 60 000 kr i projektet, 12 000 kr i
  // merkostnad, besvarad när projektet var just så stort.
  db.lagg("projekt", {
    id: P, bostad_id: X, namn: "Bytte fönster", ar: 2024, atgardstyp: "utbytt",
    battre_kvalitet: true, merkostnad: 1_200_000, merkostnad_bas: 6_000_000,
    skick_forvarv: 1, motivering: SVARET,
  });
  db.lagg("projekt_bostadsdel", { projekt_id: P, del: "FONSTER", fritext: null });
  db.lagg("projekt", { id: Q, bostad_id: X, namn: "Målade fasaden", ar: 2024, atgardstyp: "utbytt", battre_kvalitet: false, skick_forvarv: 2 });
  db.lagg("projekt", { id: GAMMALT, bostad_id: X, namn: "", ar: 2024, atgardstyp: null });

  const kvitto = (leverantor: string, belopp: number, dag: string, mal: { projekt: string; belopp: number }[]) => {
    const k = db.lagg("kostnad", {
      bostad_id: X, leverantor, totalbelopp: belopp, dokumentdatum: datum(dag), betaldatum: datum(dag),
      skapad_av: ANNA,
    });
    for (const m of mal) {
      const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: leverantor, belopp: m.belopp });
      db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: m.projekt, privat: false, andel: 1 });
    }
    return k.id as string;
  };
  fonster = kvitto("Fönsterfabriken", 4_000_000, "2024-04-02", [{ projekt: P, belopp: 4_000_000 }]);
  montage = kvitto("Montage AB", 1_500_000, "2024-04-20", [{ projekt: P, belopp: 1_500_000 }]);
  // Ett kvitto uppdelat på två projekt: 5 000 kr till fönstren, 3 000 kr till fasaden.
  delat = kvitto("Byggmax", 800_000, "2024-05-01", [
    { projekt: P, belopp: 500_000 },
    { projekt: Q, belopp: 300_000 },
  ]);
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

beforeEach(() => seeda());

/** En serverkomponent renderad i en DOM, med klientdelarna monterade. */
async function rendera(vy: Promise<unknown>): Promise<{ div: HTMLDivElement; stang: () => void }> {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const rot = createRoot(div);
  const element = await vy;
  await act(async () => rot.render(element as never));
  return {
    div,
    stang: () => {
      act(() => rot.unmount());
      div.remove();
    },
  };
}

const sidan = (id = P) => rendera(ProjektSida({ params: Promise.resolve({ id }) }));

/** Delen med rubriken hon läser – eller ett fel som säger vilken som saknades. */
function del(div: HTMLElement, titel: string): HTMLElement {
  const rubrik = [...div.querySelectorAll("h2, p")].find((e) => e.textContent === titel);
  if (!rubrik) throw new Error(`Ingen del med rubriken "${titel}"`);
  const s = rubrik.closest("section");
  if (!s) throw new Error(`Rubriken "${titel}" ligger inte i en del`);
  return s;
}

/** Raderna i en del eller ruta som hon läser dem: etikett | värde. */
function rader(e: HTMLElement): string[] {
  return [...e.querySelectorAll("div")]
    .filter((d) => d.children.length === 2 && d.children[0].tagName === "SPAN")
    // Beloppen formateras med hårt mellanslag; hon läser ett mellanslag.
    .map((d) => [...d.children].map((c) => c.textContent!.replace(/\u00a0/g, " ")).join(" | "));
}

const lankar = (e: HTMLElement, text: string) =>
  [...e.querySelectorAll("a")].filter((a) => a.textContent === text).map((a) => a.getAttribute("href"));

function formular(div: HTMLElement): FormData {
  const f = [...div.querySelectorAll("form")].find((x) => x.querySelector('button[type="submit"]')?.textContent === "Spara ändringar");
  if (!f) throw new Error("Inget formulär med Spara ändringar");
  return new FormData(f);
}

async function skrivNamn(div: HTMLElement, namn: string) {
  const falt = [...div.querySelectorAll("label")]
    .find((l) => l.textContent?.startsWith("Vad gjorde du?"))
    ?.querySelector("input");
  if (!falt) throw new Error("Inget namnfält");
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(falt, namn);
    falt.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const projektet = (id = P) => h.db.tabell("projekt").find((p) => p.id === id)!;
const delarna = (id = P) =>
  h.db.tabell("projekt_bostadsdel").filter((d) => d.projekt_id === id).map((d) => d.del);
/** Det som frågorna sparar – för att visa att en annan del inte rör det. */
const svaren = (id = P) => {
  const p = projektet(id);
  return {
    atgardstyp: p.atgardstyp, battre_kvalitet: p.battre_kvalitet, merkostnad: p.merkostnad,
    merkostnad_bas: p.merkostnad_bas, skick_forvarv: p.skick_forvarv, motivering: p.motivering,
  };
};

describe("läsvyn: tre delar med var sin Ändra", () => {
  it("Vad och var, Frågorna och Kvittona, var och en med en Ändra till sin egen skärm", async () => {
    const s = await sidan();
    expect(lankar(del(s.div, "Vad och var"), "Ändra")).toEqual([`/projekt/${P}/vad-och-var`]);
    expect(lankar(del(s.div, "Frågorna"), "Ändra")).toEqual([`/projekt/${P}/redigera`]);
    expect(lankar(del(s.div, "Kvittona"), "Ändra")).toEqual([`/projekt/${P}/kvitton/andra`]);
    // Och inget annat på sidan heter Ändra – det gamla Ändra projektet är borta.
    expect(lankar(s.div, "Ändra")).toHaveLength(3);
    expect(lankar(s.div, "Ändra projektet")).toEqual([]);
    s.stang();
  });

  it("varje del innehåller sitt och inget annat", async () => {
    const s = await sidan();
    expect(rader(del(s.div, "Vad och var"))).toEqual([
      "Namn | Bytte fönster",
      "Del av bostaden | Fönster",
    ]);
    expect(rader(del(s.div, "Frågorna"))).toEqual([
      "Vad gjordes | Bytte ut något som fanns",
      "Kvalitet | Bättre – merkostnad 12 000 kr",
      "Skick vid förvärvet | 1 – Dåligt skick",
      `Hur vet du det? | ${SVARET}`,
      "Skick vid försäljningen | Inte bekräftat än",
    ]);
    s.stang();
  });

  it("Räknas som står på läsvyn, utanför delarna och utan Ändra", async () => {
    const s = await sidan();
    const etikett = [...s.div.querySelectorAll("span")].find((e) => e.textContent === "Räknas som");
    expect(etikett, "raden Räknas som").toBeDefined();
    const ruta = etikett!.closest("section")!;
    expect(ruta.querySelector("h2"), "rutan är ingen del").toBeNull();
    expect(lankar(ruta, "Ändra")).toEqual([]);
    for (const t of ["Vad och var", "Frågorna", "Kvittona"]) {
      expect(rader(del(s.div, t)).some((r) => r.startsWith("Räknas som")), t).toBe(false);
    }
    s.stang();
  });

  it("läsvyn går inte att skriva i", async () => {
    const s = await sidan();
    expect(s.div.querySelectorAll("form, input, textarea, select")).toHaveLength(0);
    s.stang();
  });

  it("ett projekt utan svar: Frågorna har ingen Ändra men Svara på frågorna, och ett namnlöst säger det", async () => {
    const s = await sidan(GAMMALT);
    expect(lankar(del(s.div, "Frågorna"), "Ändra")).toEqual([]);
    expect(lankar(del(s.div, "Frågorna"), "Svara på frågorna")).toEqual([`/projekt/${GAMMALT}/redigera`]);
    expect(rader(del(s.div, "Vad och var"))).toEqual(["Namn | Inte angivet"]);
    expect(lankar(del(s.div, "Vad och var"), "Ändra")).toEqual([`/projekt/${GAMMALT}/vad-och-var`]);
    s.stang();
  });

  it("ett projekt utan kvitton har ingen Ändra under Kvitton – det finns inget att lyfta ut", async () => {
    const s = await sidan(GAMMALT);
    expect(del(s.div, "Kvittona").textContent).toContain("Inga kvitton i projektet än.");
    expect(lankar(del(s.div, "Kvittona"), "Ändra")).toEqual([]);
    s.stang();
  });
});

describe("Vad och var", () => {
  const skarmen = () => rendera(VadOchVarSida({ params: Promise.resolve({ id: P }) }));

  it("har namnet och delen av bostaden, förifyllda – och inga av frågorna", async () => {
    const s = await skarmen();
    const namn = [...s.div.querySelectorAll("label")].find((l) => l.textContent?.startsWith("Vad gjorde du?"))!;
    expect(namn.querySelector("input")!.value).toBe("Bytte fönster");
    expect(s.div.textContent).toContain(BOSTADSDEL_FRAGA);
    // Delen står under namnet, som i flödets första steg.
    const delfragan = [...s.div.querySelectorAll("legend")].find((l) => l.textContent === BOSTADSDEL_FRAGA)!;
    expect(namn.compareDocumentPosition(delfragan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const fonsterKnapp = [...s.div.querySelectorAll("button")].find((b) => b.textContent === "Fönster")!;
    expect(fonsterKnapp.getAttribute("aria-pressed")).toBe("true");
    expect(s.div.textContent).not.toContain("Byggde du något nytt som inte fanns tidigare?");
    expect(s.div.textContent).not.toContain("Hur var skicket vid förvärvet?");
    expect(s.div.querySelector("textarea")).toBeNull();
    expect(lankar(s.div, "Avbryt")).toEqual([`/projekt/${P}`]);
    s.stang();
  });

  it("sparar namnet och delen, rör inga av svaren, och leder tillbaka till projektet", async () => {
    const fore = svaren();
    const s = await skarmen();
    await skrivNamn(s.div, "Bytte fönster i vardagsrummet");
    const ytskikt = [...s.div.querySelectorAll("button")].find((b) => b.textContent === "Ytskikt")!;
    await act(async () => ytskikt.click());
    const f = formular(s.div);
    s.stang();
    // Formuläret skickar bara sin del.
    expect(f.has("byggde_nytt")).toBe(false);
    expect(f.has("likvardigt_byte")).toBe(false);
    expect(f.has("motivering")).toBe(false);
    await expect(sparaVadOchVar({}, f)).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
    expect(projektet().namn).toBe("Bytte fönster i vardagsrummet");
    expect(delarna().sort()).toEqual(["FONSTER", "YTSKIKT"]);
    expect(svaren()).toEqual(fore);

    // Och läsvyn efteråt: den ändrade delen visar det nya, Frågorna som förut.
    const v = await sidan();
    expect(rader(del(v.div, "Vad och var"))).toEqual([
      "Namn | Bytte fönster i vardagsrummet",
      "Del av bostaden | Ytskikt, Fönster",
    ]);
    expect(rader(del(v.div, "Frågorna"))).toContain("Kvalitet | Bättre – merkostnad 12 000 kr");
    expect(rader(del(v.div, "Frågorna"))).toContain(`Hur vet du det? | ${SVARET}`);
    v.stang();
  });

  it("ett tomt namn avvisas vid fältet och ändrar ingenting", async () => {
    const s = await skarmen();
    await skrivNamn(s.div, "   ");
    const knappen = [...s.div.querySelectorAll("button")].find((b) => b.textContent === "Spara ändringar")!;
    await act(async () => knappen.closest("form")!.requestSubmit(knappen));
    const larm = [...s.div.querySelectorAll('[role="alert"]')].map((e) => e.textContent);
    expect(larm).toEqual(["Skriv vad du gjorde."]);
    const f = formular(s.div);
    s.stang();
    // Och servern, om klienten skulle släppa igenom det.
    expect(await sparaVadOchVar({}, f)).toEqual({ fel: "Skriv vad du gjorde.", falt: "namn" });
    expect(projektet().namn).toBe("Bytte fönster");
    expect(delarna()).toEqual(["FONSTER"]);
  });

  // docs/design.md: "Den står sist på skärmen och aldrig intill Spara."
  it("Ta bort projektet står sist, med Avbryt mellan den och Spara", async () => {
    const s = await rendera(VadOchVarSida({ params: Promise.resolve({ id: GAMMALT }) }));
    const kontroller = [...s.div.querySelectorAll("main button, main a")].map((e) => e.textContent);
    const i = kontroller.indexOf("Ta bort projektet");
    expect(i, "knappen Ta bort projektet").toBeGreaterThanOrEqual(0);
    expect(i, "sist på skärmen").toBe(kontroller.length - 1);
    expect(kontroller.slice(-3)).toEqual(["Spara ändringar", "Avbryt", "Ta bort projektet"]);
    s.stang();
  });

  it("borttagningen ligger här, och säger vilka kvitton som hindrar den", async () => {
    const s = await skarmen();
    expect(s.div.textContent).toContain("Projektet går inte att ta bort så länge kvitton är kopplade hit.");
    s.stang();
  });
});

describe("Frågorna", () => {
  const skarmen = (id = P) => rendera(RedigeraSida({ params: Promise.resolve({ id }) }));

  it("har frågeträdet, men inte namnet och inte delen av bostaden", async () => {
    const s = await skarmen();
    expect(s.div.textContent).toContain("Byggde du något nytt som inte fanns tidigare?");
    expect([...s.div.querySelectorAll("label")].some((l) => l.textContent?.startsWith("Vad gjorde du?"))).toBe(false);
    expect(s.div.textContent).not.toContain(BOSTADSDEL_FRAGA);
    const f = formular(s.div);
    expect(f.has("namn")).toBe(false);
    expect(f.has("bostadsdel_fragad")).toBe(false);
    // Borttagningen hör till Vad och var.
    expect(s.div.textContent).not.toContain("Ta bort projektet");
    expect(s.div.textContent).not.toContain("Projektet går inte att ta bort");
    s.stang();
  });

  it("att spara frågorna rör inte namnet och inte delen av bostaden", async () => {
    const s = await skarmen();
    const fyra = [...s.div.querySelectorAll("button")].find((b) => b.textContent === "2 – Ganska bra skick")!;
    await act(async () => fyra.click());
    const f = formular(s.div);
    s.stang();
    await expect(redigeraProjekt({}, f)).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
    expect(projektet().skick_forvarv).toBe(2);
    expect(projektet().namn).toBe("Bytte fönster");
    expect(delarna()).toEqual(["FONSTER"]);
    // Inga tal ändras: samma merkostnad mot samma belopp.
    expect(projektet().merkostnad).toBe(1_200_000);

    const v = await sidan();
    expect(rader(del(v.div, "Vad och var"))).toEqual([
      "Namn | Bytte fönster",
      "Del av bostaden | Fönster",
    ]);
    expect(rader(del(v.div, "Frågorna"))).toContain("Skick vid förvärvet | 2 – Ganska bra skick");
    v.stang();
  });

  // docs/design.md: "det ska gälla även om fältet skulle skickas med".
  it("ett besvarat projekts namn skrivs aldrig härifrån, inte ens när fältet skickas", async () => {
    const s = await skarmen();
    const f = formular(s.div);
    s.stang();
    expect(f.has("namn"), "förutsättningen: skärmen skickar inget namn").toBe(false);
    f.set("namn", "Något annat");
    await expect(redigeraProjekt({}, f)).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
    expect(projektet().namn).toBe("Bytte fönster");
    // Ett tomt namn stoppar inte heller sparandet – fältet hör inte hit.
    f.set("namn", "");
    await expect(redigeraProjekt({}, f)).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
    expect(projektet().namn).toBe("Bytte fönster");
  });

  it("ett projekt utan svar sparar namnet här, med resten av trädet", async () => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ projekt_id: GAMMALT, namn: "Nytt golv", byggde_nytt: "ja" })) f.set(k, v);
    await expect(redigeraProjekt({}, f)).rejects.toThrow(`NEXT_REDIRECT /projekt/${GAMMALT}`);
    expect(projektet(GAMMALT)).toMatchObject({ namn: "Nytt golv", atgardstyp: "nybyggnad" });
    // Nu har projektet svar; ett tomt namn prövas på ett som ännu saknar dem.
    seeda();
    f.set("namn", "");
    expect(await redigeraProjekt({}, f)).toEqual({ fel: "Skriv vad du gjorde.", falt: "namn" });
  });


  it("ett projekt utan svar får namnfrågan här, med resten av trädet", async () => {
    const s = await skarmen(GAMMALT);
    expect([...s.div.querySelectorAll("label")].some((l) => l.textContent?.startsWith("Vad gjorde du?"))).toBe(true);
    expect(formular(s.div).has("namn")).toBe(true);
    s.stang();
  });
});

describe("Kvittona: att lyfta ut ett kvitto", () => {
  const skarmen = () => rendera(KvittonaSida({ params: Promise.resolve({ id: P }) }));

  /** Knappen på kvittots rad, hittad på leverantören hon läser. */
  function knappFor(div: HTMLElement, leverantor: string): HTMLButtonElement {
    const rad = [...div.querySelectorAll("li")].find((li) => li.textContent?.includes(leverantor));
    if (!rad) throw new Error(`Ingen rad för ${leverantor}`);
    const k = rad.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!k) throw new Error(`Ingen knapp på raden för ${leverantor}`);
    return k;
  }

  it("varje rad säger vart kvittot tar vägen", async () => {
    const s = await skarmen();
    expect(knappFor(s.div, "Fönsterfabriken").textContent).toBe("Lyft ut till kvitton utan projekt");
    expect(knappFor(s.div, "Montage AB").textContent).toBe("Lyft ut till kvitton utan projekt");
    // Det delade kvittot hamnar inte bland kvitton utan projekt.
    expect(knappFor(s.div, "Byggmax").textContent).toBe("Lyft ut – resten ligger kvar i ”Målade fasaden”");
    expect(s.div.textContent).toContain("Ett kvitto du lyfter ut raderas inte.");
    expect(lankar(s.div, "Tillbaka till projektet")).toEqual([`/projekt/${P}`]);
    s.stang();
  });

  it("kvittot lossas, det raderas inte – och hamnar bland kvitton utan projekt", async () => {
    // Förutsättningen: kvittot är inte valbart när det hör till projektet.
    expect((await hamtaValbaraKvitton(X)).map((k) => k.id)).not.toContain(fonster);
    const f = new FormData();
    f.set("projekt_id", P);
    f.set("kostnad_id", fonster);
    expect(await lyftUtKvitto({}, f)).toEqual({});
    expect(h.db.tabell("kostnad").map((k) => k.id)).toContain(fonster);
    expect(h.db.tabell("kostnadsrad").filter((r) => r.kostnad_id === fonster)).toHaveLength(1);
    expect((await hamtaValbaraKvitton(X)).map((k) => k.id)).toContain(fonster);
    // De andra kvittona ligger kvar i projektet.
    const s = await skarmen();
    expect([...s.div.querySelectorAll("li")].map((li) => li.textContent?.includes("Fönsterfabriken"))).not.toContain(true);
    expect(() => knappFor(s.div, "Montage AB")).not.toThrow();
    s.stang();
  });

  it("ett delat kvitto lämnar bara det här projektet", async () => {
    const f = new FormData();
    f.set("projekt_id", P);
    f.set("kostnad_id", delat);
    expect(await lyftUtKvitto({}, f)).toEqual({});
    const rader = h.db.tabell("kostnadsrad").filter((r) => r.kostnad_id === delat).map((r) => r.id);
    const mal = h.db.tabell("radfordelning").filter((d) => rader.includes(d.kostnadsrad_id)).map((d) => d.projekt_id);
    expect(mal).toEqual([Q]);
  });

  it("merkostnaden rörs inte – projektet frågar i stället om svaret fortfarande stämmer", async () => {
    const f = new FormData();
    f.set("projekt_id", P);
    f.set("kostnad_id", montage);
    await lyftUtKvitto({}, f);
    expect(projektet().merkostnad).toBe(1_200_000);
    expect(projektet().merkostnad_bas).toBe(6_000_000);
    // Samma uppslag som redigeringen gör.
    const { belopp } = await hamtaProjektetsBelopp(X, P);
    expect(belopp).toBe(4_500_000);
    expect(merkostnadBehoverBekraftas(tillDomanProjekt(projektet() as never), belopp)).toBe("projektet_andrat");

    // Mellanläget: Kvittona är ändrade, Frågorna inte. Läsvyn säger det där
    // svaret står, och vägen att svara igen leder till Frågorna.
    const v = await sidan();
    const fragorna = del(v.div, "Frågorna");
    const fragan = merkostnadUpplysning("projektet_andrat", projektet() as never, belopp, "fraga");
    expect(fragorna.textContent).toContain(fragan);
    expect(lankar(fragorna, "Svara igen")).toEqual([`/projekt/${P}/redigera`]);
    expect(rader(del(v.div, "Vad och var"))).toEqual(["Namn | Bytte fönster", "Del av bostaden | Fönster"]);
    v.stang();
  });

  it("Välj bland dina kvitton står här bara när det finns något att välja", async () => {
    const utan = await skarmen();
    expect(lankar(utan.div, "Välj bland dina kvitton")).toEqual([]);
    utan.stang();
    const f = new FormData();
    f.set("projekt_id", P);
    f.set("kostnad_id", fonster);
    await lyftUtKvitto({}, f);
    const med = await skarmen();
    expect(lankar(med.div, "Välj bland dina kvitton")).toEqual([`/projekt/${P}/kvitton?fran=kvittona`]);
    med.stang();
  });
});

// docs/design.md, "Skärmen heter samma sak som delen den ändrar", och
// Tryckytor: bakåt heter destinationen. Alla tre leder tillbaka till
// projektets sida, som heter som projektet – aldrig som skärmen man står på.
describe("varje skärm heter som sin del, och bakåt heter projektet", () => {
  it.each([
    ["Vad och var", () => VadOchVarSida({ params: Promise.resolve({ id: P }) })],
    ["Frågorna", () => RedigeraSida({ params: Promise.resolve({ id: P }) })],
    ["Kvittona", () => KvittonaSida({ params: Promise.resolve({ id: P }) })],
  ] as const)("%s", async (titel, vy) => {
    const s = await rendera(vy());
    expect([...s.div.querySelectorAll("h1")].map((e) => e.textContent)).toEqual([titel]);
    // Delen på läsvyn har samma namn.
    const v = await sidan();
    expect(() => del(v.div, titel)).not.toThrow();
    v.stang();
    const bak = [...s.div.querySelectorAll("a")].filter((a) => a.getAttribute("href") === `/projekt/${P}`);
    const texter = bak.map((a) => a.textContent!.replace(/^←\s*/, ""));
    expect(texter, "bakåtlänken").toContain("Bytte fönster");
    expect(texter).not.toContain(titel);
    s.stang();
  });
});

// docs/design.md, "Att välja till kvitton slutar på projektsidan, men bara
// när något sparats": ett avbrott lämnar henne där hon stod, ett sparande får
// flytta henne dit resultatet syns. Bakåt i sidhuvudet är också ett avbrott.
describe("Välj bland dina kvitton: tillbaka dit hon kom ifrån, efter ett sparande till projektet", () => {
  const valj = (fran?: string) =>
    rendera(ValjSida({ params: Promise.resolve({ id: P }), searchParams: Promise.resolve(fran === undefined ? {} : { fran }) }));

  /** Sidhuvudets bakåtlänk: texten utan pilen, och vart den går. */
  function bakat(div: HTMLElement): [string, string | null][] {
    return [...div.querySelectorAll("a")]
      .filter((a) => a.textContent!.startsWith("←"))
      .map((a) => [a.textContent!.replace(/^←\s*/, ""), a.getAttribute("href")]);
  }

  async function lyftUtFonstret() {
    const f = new FormData();
    f.set("projekt_id", P);
    f.set("kostnad_id", fonster);
    await lyftUtKvitto({}, f);
  }

  it("från Kvittona: Avbryt och bakåt leder till Kvittona", async () => {
    await lyftUtFonstret();
    const s = await valj("kvittona");
    expect(lankar(s.div, "Avbryt")).toEqual([`/projekt/${P}/kvitton/andra`]);
    expect(bakat(s.div)).toEqual([["Kvittona", `/projekt/${P}/kvitton/andra`]]);
    s.stang();
  });

  it("från projektsidan: Avbryt och bakåt leder till projektet", async () => {
    await lyftUtFonstret();
    const s = await valj();
    expect(lankar(s.div, "Avbryt")).toEqual([`/projekt/${P}`]);
    expect(bakat(s.div)).toEqual([["Bytte fönster", `/projekt/${P}`]]);
    s.stang();
  });

  it("ett okänt ursprung leder till projektet – parametern pekar aldrig någon annanstans", async () => {
    await lyftUtFonstret();
    for (const fran of ["https://exempel.se", "/kostnad", "Kvittona"]) {
      const s = await valj(fran);
      expect(lankar(s.div, "Avbryt"), fran).toEqual([`/projekt/${P}`]);
      expect(bakat(s.div), fran).toEqual([["Bytte fönster", `/projekt/${P}`]]);
      s.stang();
    }
  });

  it("utan något att välja går Tillbaka också dit hon kom ifrån", async () => {
    const s = await valj("kvittona");
    // Förutsättningen: inget kvitto är valbart, så listan är tom.
    expect(s.div.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(lankar(s.div, "Tillbaka")).toEqual([`/projekt/${P}/kvitton/andra`]);
    s.stang();
  });

  it("efter ett sparande hamnar hon på projektet, också när hon kom från Kvittona", async () => {
    await lyftUtFonstret();
    const s = await valj("kvittona");
    const ruta = [...s.div.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(ruta, "fönsterkvittot går att välja").toHaveLength(1);
    await act(async () => ruta[0].click());
    const knappen = [...s.div.querySelectorAll("button")].find((b) => b.textContent === "Lägg till")!;
    const f = new FormData(knappen.closest("form")!);
    s.stang();
    // Projektet har ändrats sedan merkostnaden besvarades; svaret ges om på
    // Frågorna. Här prövas bara vart sparandet leder.
    await expect(laggTillKvitton({}, f)).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
  });
});
