// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { radensEtikett } from "./_bostadsdelar-design";
import { designensHjalptexter, normalisera } from "./_merkostnadslydelser";

// Projektflödet, provat pa det som renderas (docs/design.md, "Att skapa ett
// projekt"). Den riktiga sidan kors mot en falsk databas och renderas hel i
// en DOM; bara server-actionen ar utbytt, sa att testet ser vad som skickas.
//
//   1. Ordningen: vad gjorde du och vilken del av bostaden → fragetradet →
//      vilka kvitton hörde hit. Framsteget ar "N av 3", utan ordet fore, och
//      ingenstans star hur manga fragorna ar. Delen ar frivillig och star
//      under namnet; Nästa hoppar over den.
//   2. Varje steg provas innan nasta: ett tomt namn eller en obesvarad fraga
//      stoppar vid sin fraga.
//   3. Tillstandet mellan stegen (CLAUDE.md): ingenting skickas forran
//      Spara, och det som skrivits ligger kvar om hon gar darifran.
//   4. Ett fel som hor till ett tidigare steg visas dar fragan star.
//   5. Merkostnaden stalls i kvittosteget, och bara nar det finns ett belopp.
//   6. Ett aterupptaget utkast sager att det ar ett, och gar att kasta.
//
// Hur anteckningen ryms pa tva rader och att bara en sak ar orange mats i
// Chrome, i tester/anteckning-tva-rader-layout.test.ts – jsdom raknar ingen
// layout.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
    skapaProjekt: vi.fn(async (_f: unknown, _d: FormData): Promise<{ skapat?: string; fel?: string; falt?: string }> => ({})),
    ersatt: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/projekt/nytt",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: h.ersatt }),
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
vi.mock("@/app/projekt/actions", () => ({ skapaProjekt: h.skapaProjekt }));

import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Friskrivning } from "@/components/skarm";
import { createRoot, type Root } from "react-dom/client";
import NyttProjektSida from "@/app/projekt/nytt/page";
import { utkastNyckel } from "@/app/projekt/nytt/flode";
import { BOSTADSDEL_FRAGA } from "@/doman/bostadsdel";
import { LIKVARDIGT_ETIKETT } from "@/app/projekt/fragetradet";
import {
  likvardigtMasteAngesFel,
  likvardigtOverBeloppetFel,
  tolkaFragetradetFormData,
} from "@/lib/fragetradet-formdata";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-0000000000d1";
const X = "b0000000-0000-4000-8000-0000000000d1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const FARG = "Färg och penslar till sovrummet, väggarna var slitna sedan vi flyttade in";
let fargId = "";

function seeda() {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "bostadsratt",
    tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // Bauhaus-kvittot (produktspec 11): 1 020,95 kr, varav 229 kr privat.
  const k = db.lagg("kostnad", {
    bostad_id: X, leverantor: "Bauhaus Bromma", anteckning: FARG, totalbelopp: 102_095,
    dokumentdatum: datum("2026-08-22"), betaldatum: datum("2026-08-22"), skapad_av: ANNA,
  });
  fargId = k.id as string;
  db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "LIVING VÄGGFÄRG HE", belopp: 79_195 });
  const privat = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "TORKSTATIV SUSSI BLA", belopp: 22_900 });
  db.lagg("radfordelning", { kostnadsrad_id: privat.id, projekt_id: null, privat: true, andel: 1 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  seeda();
  h.skapaProjekt.mockReset();
  h.skapaProjekt.mockResolvedValue({});
  h.ersatt.mockReset();
  window.localStorage.clear();
  vi.stubGlobal("scrollTo", () => {});
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
  vi.unstubAllGlobals();
});

async function rendera() {
  const vy = await NyttProjektSida();
  await act(async () => rot.render(vy));
}

/** Synligt = inte inne i nagot med attributet hidden. */
function synlig(el: Element): boolean {
  return el.closest("[hidden]") === null;
}

function synligText(): string {
  const kopia = behallare.cloneNode(true) as HTMLElement;
  kopia.querySelectorAll("[hidden]").forEach((e) => e.remove());
  return kopia.textContent ?? "";
}

/** Framstegsraden – elementet vars hela text ar "N av M". */
function framsteg(): string {
  const traff = [...behallare.querySelectorAll("p")].filter((p) => /^\d+ av \d+$/.test(p.textContent ?? ""));
  expect(traff, "framstegsraden ska stå en gång").toHaveLength(1);
  return traff[0].textContent!;
}

function knapp(text: string): HTMLButtonElement {
  const k = [...behallare.querySelectorAll("button")].find((b) => synlig(b) && b.textContent === text);
  if (!k) throw new Error(`Ingen synlig knapp "${text}"`);
  return k;
}

async function tryck(text: string) {
  await act(async () => knapp(text).click());
}

async function skrivNamn(namn: string) {
  const falt = behallare.querySelector<HTMLInputElement>('input[type="text"]')!;
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(falt, namn);
    falt.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function synligaLarm(): string[] {
  return [...behallare.querySelectorAll('[role="alert"]')].filter(synlig).map((e) => e.textContent!);
}

/** Svarar pa fragetradet: utbytt mot liknande, skick 1 vid forvarvet. */
async function svaraUtbyttLiknande() {
  await tryck("Nej");
  // Fraga 3 har ocksa ett "Nej"; det forsta ar fraga 2:s, nu valt.
  const nej = [...behallare.querySelectorAll("button")].filter((b) => synlig(b) && b.textContent === "Nej");
  await act(async () => nej[1].click());
  await tryck("Jag bytte ut något som fanns");
  await tryck("Liknande som tidigare");
  await tryck("1 – Dåligt skick");
}

describe("ordningen och framsteget", () => {
  it("namnet och bostadsdelen, frågeträdet, kvittona – som 1 av 3 till 3 av 3", async () => {
    await rendera();
    expect(framsteg()).toBe("1 av 3");
    expect(synligText()).toContain("Vad gjorde du?");
    expect(synligText()).toContain(BOSTADSDEL_FRAGA);
    expect(synligText()).not.toContain("Byggde du något nytt som inte fanns tidigare?");

    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    expect(framsteg()).toBe("2 av 3");
    expect(synligText()).toContain("Byggde du något nytt som inte fanns tidigare?");
    expect(synligText()).not.toContain("Vad gjorde du?");
    expect(synligText()).not.toContain(BOSTADSDEL_FRAGA);

    await svaraUtbyttLiknande();
    await tryck("Nästa");
    expect(framsteg()).toBe("3 av 3");
    const rubrik = [...behallare.querySelectorAll("legend")].find(synlig)!;
    expect(rubrik.textContent).toBe("Vilka kvitton hörde till ”Måla sovrummet”?");
    expect([...behallare.querySelectorAll('input[type="checkbox"]')].filter(synlig)).toHaveLength(1);
  });

  // docs/design.md: "Att hoppa över den ska gå utan att först trycka sig
  // förbi den." Ett tryck på Nästa, med delen obesvarad, och frågeträdet
  // står där.
  it("bostadsdelen står under namnet och hoppas över med samma Nästa", async () => {
    await rendera();
    const namnfalt = behallare.querySelector<HTMLInputElement>('input[type="text"]')!;
    const ytskikt = knapp("Ytskikt");
    expect(namnfalt.compareDocumentPosition(ytskikt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ytskikt.getAttribute("aria-pressed")).toBe("false");
    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    expect(framsteg()).toBe("2 av 3");
    expect(synligaLarm()).toEqual([]);
    expect(synligText()).toContain("Byggde du något nytt som inte fanns tidigare?");
  });

  // docs/design.md, "Och att den är frivillig måste synas". Lydelsen läses
  // ur filen.
  it("under delens knappar står att den är valfri", async () => {
    const m = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8").match(
      /Under knapparna står därför en dämpad rad: \*\*"([^"]+)"\*\*/,
    );
    if (!m) throw new Error("design.md saknar raden under knapparna");
    await rendera();
    const rad = [...behallare.querySelectorAll("p")].filter((p) => synlig(p) && p.textContent === m[1]);
    expect(rad, "raden, synlig på första steget").toHaveLength(1);
    const knappar = [...behallare.querySelectorAll("[data-bostadsdel] button")];
    expect(knappar.at(-1)!.compareDocumentPosition(rad[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("skicket vid förvärvet ställs när något byttes ut, och inte när det byggdes nytt", async () => {
    await rendera();
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    expect(synligText()).not.toContain("Hur var skicket vid förvärvet?");
    await tryck("Nej");
    const nej = [...behallare.querySelectorAll("button")].filter((b) => synlig(b) && b.textContent === "Nej");
    await act(async () => nej[1].click());
    await tryck("Jag bytte ut något som fanns");
    await tryck("Liknande som tidigare");
    expect(synligText()).toContain("Hur var skicket vid förvärvet?");
  });

  it("ingenstans står hur många frågorna är", async () => {
    await rendera();
    expect(behallare.textContent).not.toMatch(/\d+\s+frågor/);
    expect(behallare.textContent).not.toMatch(/Fråga \d/);
  });
});

// docs/design.md, "Namnfältet är tomt, och föreslår ingenting". Prövades
// till 2026-11-13 i genomgångens fas 2, som är riven; regeln gäller här.
describe("namnfältet", () => {
  it("är tomt och föreslår ingenting, fast kvittot har en anteckning", async () => {
    await rendera();
    // Förutsättningen: det finns en anteckning att föreslå ur.
    expect(behallare.textContent).toContain(FARG);
    const falt = behallare.querySelector<HTMLInputElement>('input[type="text"]')!;
    expect(falt.value).toBe("");
    expect(behallare.querySelector<HTMLInputElement>('input[type="hidden"][name="namn"]')!.value).toBe("");
  });
});

describe("varje steg prövas innan nästa", () => {
  it("ett tomt namn stoppar vid namnet, med serverns lydelse", async () => {
    await rendera();
    await tryck("Nästa");
    const vantat = tolkaFragetradetFormData(new FormData(), { belopp: 0, harRot: false });
    expect("fel" in vantat && vantat.falt).toBe("namn");
    expect(synligaLarm()).toEqual(["fel" in vantat ? vantat.fel : ""]);
    expect(framsteg()).toBe("1 av 3");
  });

  it("en obesvarad fråga stoppar i frågeträdet", async () => {
    await rendera();
    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    await tryck("Nästa");
    expect(framsteg()).toBe("2 av 3");
    expect(synligaLarm()).toEqual(["Svara på om du byggde något nytt."]);
  });
});

describe("tillståndet mellan stegen", () => {
  it("ingenting skickas förrän Spara, och då allt på en gång", async () => {
    await rendera();
    await skrivNamn("Måla sovrummet");
    await tryck("Ytskikt");
    await tryck("Nästa");
    await svaraUtbyttLiknande();
    await tryck("Nästa");
    expect(h.skapaProjekt).not.toHaveBeenCalled();

    await act(async () => behallare.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await act(async () => knapp("Spara projektet").closest("form")!.requestSubmit(knapp("Spara projektet")));
    expect(h.skapaProjekt).toHaveBeenCalledTimes(1);
    const data = h.skapaProjekt.mock.calls[0][1];
    expect(data.get("namn")).toBe("Måla sovrummet");
    expect(data.getAll("bostadsdel")).toEqual(["YTSKIKT"]);
    expect(data.get("nytt_eller_bytt")).toBe("bytt");
    expect(data.get("skick_forvarv")).toBe("1");
    expect(data.getAll("kostnad_ider")).toEqual([fargId]);
  });

  it("det som skrivits ligger kvar när hon går därifrån och kommer tillbaka", async () => {
    await rendera();
    await skrivNamn("Måla sovrummet");
    await tryck("Ytskikt");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");

    // Hon lämnar sidan – flödet tas bort – och öppnar den igen.
    act(() => rot.unmount());
    rot = createRoot(behallare);
    await rendera();

    expect(framsteg()).toBe("2 av 3");
    expect(knapp("Ja, det är helt nytt").getAttribute("aria-pressed")).toBe("true");
    await tryck("Tillbaka");
    expect(framsteg()).toBe("1 av 3");
    expect(knapp("Ytskikt").getAttribute("aria-pressed")).toBe("true");
    expect(behallare.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("Måla sovrummet");
    // Första steget har inget att gå tillbaka till.
    expect(() => knapp("Tillbaka")).toThrow();
    expect(h.skapaProjekt).not.toHaveBeenCalled();
  });

  it("ett flöde ingen rört lämnar inget utkast", async () => {
    await rendera();
    await tryck("Nästa");
    expect(window.localStorage.getItem(utkastNyckel(X))).toBeNull();
  });

  // docs/design.md, "Och sparandet leder till projektlistan": sammanfattningen
  // hon nyss läste är bekräftelsen, och projektsidan hade visat den igen.
  it("när projektet sparats är utkastet borta och hon hamnar i projektlistan", async () => {
    h.skapaProjekt.mockResolvedValue({ skapat: "c0000000-0000-4000-8000-0000000000d9" });
    await rendera();
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    await tryck("Nästa");
    expect(window.localStorage.getItem(utkastNyckel(X))).not.toBeNull();
    await act(async () => knapp("Spara projektet").closest("form")!.requestSubmit(knapp("Spara projektet")));
    expect(window.localStorage.getItem(utkastNyckel(X))).toBeNull();
    expect(h.ersatt).toHaveBeenCalledTimes(1);
    expect(h.ersatt).toHaveBeenCalledWith("/projekt");
  });
});

/** Svarar fram till fråga 5 = bättre kvalitet och skick 1, med namnet satt. */
async function svaraBattre() {
  await skrivNamn("Måla sovrummet");
  await tryck("Nästa");
  await tryck("Nej");
  const nej = [...behallare.querySelectorAll("button")].filter((b) => synlig(b) && b.textContent === "Nej");
  await act(async () => nej[1].click());
  await tryck("Jag bytte ut något som fanns");
  await tryck("Bättre kvalitet");
  await tryck("1 – Dåligt skick");
}

/** Det synliga merkostnadsfältet, eller null – hittat på etiketten hon läser. */
function merkostnadsfalt(): HTMLInputElement | null {
  const etikett = [...behallare.querySelectorAll("label")].find(
    (l) => synlig(l) && l.textContent?.startsWith(LIKVARDIGT_ETIKETT),
  );
  return etikett?.querySelector<HTMLInputElement>("input") ?? null;
}

async function skriv(falt: HTMLInputElement, text: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(falt, text);
    falt.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function kryssa() {
  await act(async () => behallare.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
}

async function spara() {
  await act(async () => knapp("Spara projektet").closest("form")!.requestSubmit(knapp("Spara projektet")));
}

// Merkostnaden är den enda frågan som behöver ett belopp, och den ställs
// därför bara när det finns ett (docs/design.md, "Att skapa ett projekt").
// I flödet finns beloppet först när kvittona valts, i sista steget.
describe("merkostnaden ställs när det finns ett belopp att dela", () => {
  it("inte i frågeträdet, och i kvittosteget först när ett kvitto med belopp är valt", async () => {
    await rendera();
    await svaraBattre();
    expect(framsteg()).toBe("2 av 3");
    expect(merkostnadsfalt(), "inget merkostnadsfält i frågeträdet").toBeNull();
    await tryck("Nästa");
    expect(framsteg()).toBe("3 av 3");
    expect(merkostnadsfalt(), "inget fält utan valt kvitto").toBeNull();
    await kryssa();
    expect(merkostnadsfalt(), "fältet ska komma när kvittot valts").not.toBeNull();
    await kryssa();
    expect(merkostnadsfalt(), "och gå när kvittot väljs bort").toBeNull();
  });

  it("utan kvitton skjuts den upp, och projektet sparas", async () => {
    await rendera();
    await svaraBattre();
    await tryck("Nästa");
    await spara();
    expect(synligaLarm()).toEqual([]);
    expect(h.skapaProjekt).toHaveBeenCalledTimes(1);
    const data = h.skapaProjekt.mock.calls[0][1];
    expect(data.get("battre_eller_liknande")).toBe("battre");
    expect(data.getAll("kostnad_ider")).toEqual([]);
  });

  it("med ett valt kvitto krävs den, och spärren gäller vid fältet", async () => {
    await rendera();
    await svaraBattre();
    await tryck("Nästa");
    await kryssa();
    await spara();
    expect(h.skapaProjekt).not.toHaveBeenCalled();
    expect(framsteg()).toBe("3 av 3");
    expect(synligaLarm()).toEqual([likvardigtMasteAngesFel(79_195, false)]);

    // Svaret är vad ett likvärdigt byte hade kostat. 791,95 kr är vad
    // målningsraderna kostade – torkstället var privat – och ett lika stort
    // svar ger ingen merkostnad.
    await skriv(merkostnadsfalt()!, "791,95");
    await spara();
    expect(h.skapaProjekt).not.toHaveBeenCalled();
    expect(framsteg()).toBe("3 av 3");
    expect(synligaLarm()).toEqual([likvardigtOverBeloppetFel(79_195, false)]);

    await skriv(merkostnadsfalt()!, "0");
    await spara();
    expect(h.skapaProjekt).not.toHaveBeenCalled();
    expect(synligaLarm()).toEqual([likvardigtMasteAngesFel(79_195, false)]);

    await skriv(merkostnadsfalt()!, "791,94");
    await spara();
    expect(h.skapaProjekt).toHaveBeenCalledTimes(1);
    expect(h.skapaProjekt.mock.calls[0][1].get("likvardigt_byte")).toBe("791,94");
    expect(h.skapaProjekt.mock.calls[0][1].get("merkostnad")).toBeNull();
  });
});

// docs/design.md, "Och ett utkast går alltid att kasta".
describe("ett utkast går att kasta", () => {
  const UTKASTET = "Det här är ett utkast du började på tidigare.";

  async function lamnaOchKomTillbaka() {
    act(() => rot.unmount());
    rot = createRoot(behallare);
    await rendera();
  }

  it("ett flöde utan utkast säger ingenting om utkast och har ingen Börja om", async () => {
    await rendera();
    expect(synligText()).not.toContain(UTKASTET);
    expect(() => knapp("Börja om")).toThrow();
  });

  // Ett tomt utkast sparas aldrig, men kan ligga kvar från en äldre version
  // eller en annan flik. Det är inget påbörjat projekt, och skärmen ska inte
  // påstå att det är ett.
  it("ett tomt utkast i lagringen säger ingenting om utkast", async () => {
    window.localStorage.setItem(
      utkastNyckel(X),
      JSON.stringify({ steg: 1, namn: "", bostadsdelar: [], svar: {}, valda: [] }),
    );
    expect(window.localStorage.getItem(utkastNyckel(X)), "förutsättningen: ett tomt utkast ligger där").not.toBeNull();
    await rendera();
    expect(synligText()).not.toContain(UTKASTET);
    expect(() => knapp("Börja om")).toThrow();
  });

  it("ett återupptaget utkast säger att det är ett, och Börja om tömmer allt", async () => {
    await rendera();
    await skrivNamn("Måla sovrummet");
    await tryck("Ytskikt");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    await lamnaOchKomTillbaka();

    expect(synligText()).toContain(UTKASTET);
    expect(framsteg()).toBe("2 av 3");
    await tryck("Börja om");

    expect(framsteg()).toBe("1 av 3");
    expect(behallare.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("");
    expect(synligText()).not.toContain(UTKASTET);
    expect(window.localStorage.getItem(utkastNyckel(X))).toBeNull();
    // Inget av de gamla svaren ligger kvar dolt.
    expect(knapp("Ytskikt").getAttribute("aria-pressed")).toBe("false");
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    expect(knapp("Ja, det är helt nytt").getAttribute("aria-pressed")).toBe("false");
    expect(h.skapaProjekt).not.toHaveBeenCalled();

    // Och en ny omgång börjar utan utkastets rad.
    await lamnaOchKomTillbaka();
    expect(synligText()).toContain(UTKASTET);
  });
});

describe("ett fel i ett tidigare steg visas där frågan står", () => {
  // Ett utkast som står på sista steget utan skicket vid förvärvet – som när
  // ett äldre utkast läses in. Spara ska då leda tillbaka till frågan.
  // Utkastet är från fyra steg (ingen version), där 4 var kvittosteget.
  it("ett saknat skick vid förvärvet skickar tillbaka till frågeträdet", async () => {
    window.localStorage.setItem(
      utkastNyckel(X),
      JSON.stringify({
        steg: 4,
        namn: "Måla sovrummet",
        bostadsdelar: [],
        svar: {
          byggdeNytt: "nej", andradePlanlosning: "nej", nyttEllerBytt: "bytt",
          battreEllerLiknande: "liknande", merkostnad: null, likvardigtText: "",
          skickForvarv: "", motivering: "",
        },
        valda: [],
      }),
    );
    await rendera();
    expect(framsteg()).toBe("3 av 3");
    await spara();
    expect(h.skapaProjekt).not.toHaveBeenCalled();
    expect(framsteg()).toBe("2 av 3");
    expect(synligaLarm()).toEqual(["Ange skicket vid förvärvet, 0–5."]);
  });
});

// docs/design.md, "Sista steget sammanfattar innan det sparar" (2026-11-18):
// ovanför kvittolistan står vad hon svarat – namnet, delen av bostaden, vad
// som gjordes, kvaliteten, skicket – och vad det räknas som. Knappen heter
// Spara projektet. Inget femte steg.
describe("sista steget sammanfattar innan det sparar", () => {
  /** Sammanfattningens rader som hon läser dem: etikett och värde, hela
   *  texten, nod för nod så att ordgränsen bevaras. Stannar om den saknas. */
  function sammanfattningen(): string[] {
    const s = [...behallare.querySelectorAll('[aria-label="Det du svarat"]')].filter(synlig);
    expect(s, "en synlig sammanfattning").toHaveLength(1);
    return [...s[0].children].map((rad) =>
      rad.children.length === 0
        ? rad.textContent!
        : [...rad.children].map((e) => e.textContent).join(" | "),
    );
  }

  it("utbytt mot liknande: allt hon svarat, och vad det räknas som", async () => {
    await rendera();
    await skrivNamn("Måla sovrummet");
    await tryck("Ytskikt");
    await tryck("Nästa");
    await svaraUtbyttLiknande();
    await tryck("Nästa");
    expect(framsteg()).toBe("3 av 3");
    expect(sammanfattningen()).toEqual([
      "Måla sovrummet",
      "Räknas som | Reparation",
      `${radensEtikett()} | Ytskikt`,
      "Vad gjordes | Bytte ut något som fanns",
      "Kvalitet | Liknande som tidigare",
      "Skick vid förvärvet | 1 – Dåligt skick",
    ]);
  });

  it("byggt nytt: grundförbättring, utan kvalitet och skick", async () => {
    await rendera();
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    await tryck("Nästa");
    expect(sammanfattningen()).toEqual([
      "Ny altan",
      "Räknas som | Grundförbättring",
      "Vad gjordes | Byggde något nytt",
    ]);
  });

  it("bättre kvalitet: grundförbättring och reparation", async () => {
    await rendera();
    await svaraBattre();
    await tryck("Nästa");
    expect(sammanfattningen()).toContain("Räknas som | Grundförbättring och reparation");
    expect(sammanfattningen()).toContain("Kvalitet | Bättre");
  });

  it("står ovanför kvittolistan, och knappen under heter Spara projektet", async () => {
    await rendera();
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    await tryck("Nästa");
    const s = behallare.querySelector('[aria-label="Det du svarat"]')!;
    const lista = behallare.querySelector('input[type="checkbox"]')!;
    expect(s.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const knappen = knapp("Spara projektet");
    expect(knappen.type).toBe("submit");
    expect(lista.compareDocumentPosition(knappen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(() => knapp("Spara")).toThrow();
  });

  it("syns bara i sista steget – och stegen är tre", async () => {
    await rendera();
    await skrivNamn("Ny altan");
    for (const steg of ["1 av 3", "2 av 3"]) {
      expect(framsteg()).toBe(steg);
      expect([...behallare.querySelectorAll('[aria-label="Det du svarat"]')].filter(synlig)).toHaveLength(0);
      if (steg === "2 av 3") await tryck("Ja, det är helt nytt");
      await tryck("Nästa");
    }
    expect(framsteg()).toBe("3 av 3");
    expect(() => knapp("Nästa")).toThrow();
  });
});

// docs/design.md, "Hur vet du det?" hör inte till flödet: fältet flyttar till
// projektets sida (tester/motivering-projektsidan.test.ts).
describe("Hur vet du det? står inte i flödet", () => {
  it("inte ens när skicket vid förvärvet är 0 – då frågan annars ställdes", async () => {
    await rendera();
    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    await tryck("Nej");
    const nej = [...behallare.querySelectorAll("button")].filter((b) => synlig(b) && b.textContent === "Nej");
    await act(async () => nej[1].click());
    await tryck("Jag bytte ut något som fanns");
    await tryck("Liknande som tidigare");
    // Förutsättningen: skickfrågan står där, och 0 är valt.
    await tryck("0 – Mycket dåligt skick");
    expect(knapp("0 – Mycket dåligt skick").getAttribute("aria-pressed")).toBe("true");
    expect(behallare.textContent).not.toContain("Hur vet du det?");
    expect(behallare.querySelector("textarea")).toBeNull();
  });

  it("ett utkast som redan bar ett svar skickar det med – ingen tappar det hon skrivit", async () => {
    window.localStorage.setItem(
      utkastNyckel(X),
      JSON.stringify({
        steg: 4,
        namn: "Måla sovrummet",
        bostadsdelar: [],
        svar: {
          byggdeNytt: "nej", andradePlanlosning: "nej", nyttEllerBytt: "bytt",
          battreEllerLiknande: "liknande", merkostnad: null, likvardigtText: "",
          skickForvarv: "1", motivering: "Mäklarbilden visar fläckig vägg",
        },
        valda: [],
      }),
    );
    await rendera();
    await spara();
    expect(h.skapaProjekt).toHaveBeenCalledTimes(1);
    expect(h.skapaProjekt.mock.calls[0][1].get("motivering")).toBe("Mäklarbilden visar fläckig vägg");
  });

  it("och ett flöde utan sådant svar skickar inget fält alls", async () => {
    await rendera();
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    await tryck("Nästa");
    await spara();
    expect(h.skapaProjekt.mock.calls[0][1].has("motivering")).toBe(false);
  });
});

// Hjälptextens två lydelser (docs/design.md, "Hjälptexten har två lydelser"):
// ROT-lydelsen bara när ett valt kvitto bär ROT. Talet är spärrens – före
// ROT, utan privat del. Lydelserna själva prövas mot design.md i
// tester/likvardigt-byte.test.ts; här prövas att flödet väljer rätt.
describe("merkostnadsfrågans hjälptext i flödet", () => {
  const ROT_KVITTO = "Ny köksbänk, montering";

  function laggTillRotKvitto() {
    const k = h.db.lagg("kostnad", {
      bostad_id: X, leverantor: "Köksbolaget AB", anteckning: ROT_KVITTO, totalbelopp: 6_081_250,
      rot_utnyttjat: 1_158_750, dokumentdatum: datum("2026-05-02"), betaldatum: datum("2026-05-02"), skapad_av: ANNA,
    });
    h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Bänk och montering", belopp: 6_081_250 });
  }

  function hjalptexten(): string {
    const label = [...behallare.querySelectorAll("label")].find(
      (l) => synlig(l) && l.textContent?.startsWith(LIKVARDIGT_ETIKETT),
    );
    expect(label, "merkostnadsfrågan").toBeTruthy();
    return label!.lastElementChild!.textContent!.replace(/ /g, " ");
  }

  async function valj(rubrik: string) {
    const ruta = [...behallare.querySelectorAll("label")]
      .find((l) => l.textContent?.includes(rubrik))!
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => ruta.click());
  }

  it("ett kvitto utan ROT: projektets belopp, utan ord om ROT", async () => {
    laggTillRotKvitto();
    await rendera();
    await svaraBattre();
    await tryck("Nästa");
    await valj(FARG);
    expect(hjalptexten()).toContain("Projektet kostade 791,95 kr,");
    expect(hjalptexten()).not.toMatch(/ROT/);
  });

  it("ett kvitto med ROT: beloppet före ROT-avdraget", async () => {
    laggTillRotKvitto();
    await rendera();
    await svaraBattre();
    await tryck("Nästa");
    await valj(ROT_KVITTO);
    // Hela hjälptexten, ordagrant ur design.md – citatet med ROT är skrivet
    // för just 60 812,50 kr, ROT-kvittots belopp före avdraget.
    expect(normalisera(hjalptexten())).toBe(designensHjalptexter()[1][1]);
  });
});

// Ett utkast sparat innan stegen blev tre (docs/design.md, 2026-11-19) bär
// sitt steg i den gamla räkningen, där namnet och delen var var sitt. Det ska
// öppnas på samma fråga som hon lämnade, inte ett steg för långt fram.
describe("ett utkast från fyra steg öppnas där hon var", () => {
  const SVAR = {
    byggdeNytt: "ja", andradePlanlosning: "", nyttEllerBytt: "",
    battreEllerLiknande: "", merkostnad: null, likvardigtText: "",
    skickForvarv: "", motivering: "",
  };
  const gammalt = (steg: number) =>
    window.localStorage.setItem(
      utkastNyckel(X),
      JSON.stringify({ steg, namn: "Ny altan", bostadsdelar: [], svar: SVAR, valda: [] }),
    );

  it("gamla steg 2, delen av bostaden, öppnas på första steget, där delen står nu", async () => {
    gammalt(2);
    await rendera();
    expect(framsteg()).toBe("1 av 3");
    expect(synligText()).toContain(BOSTADSDEL_FRAGA);
  });

  it("gamla steg 3, frågeträdet, öppnas på frågeträdet", async () => {
    gammalt(3);
    await rendera();
    expect(framsteg()).toBe("2 av 3");
    expect(knapp("Ja, det är helt nytt").getAttribute("aria-pressed")).toBe("true");
  });

  it("ett nytt utkast på steg 2 är frågeträdet, inte delen", async () => {
    await rendera();
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    const sparat = JSON.parse(window.localStorage.getItem(utkastNyckel(X))!);
    expect(sparat.steg).toBe(2);
    act(() => rot.unmount());
    rot = createRoot(behallare);
    await rendera();
    expect(framsteg()).toBe("2 av 3");
  });
});

// docs/design.md, "Friskrivningen står inte i frågeträdet" (struket
// 2026-11-22): raden om skatterådgivning bor på exportvyn. I stället står
// raden om Skatteverkets regler, en gång och i första steget.
describe("friskrivningen står inte i frågeträdet", () => {
  it("inte i något av de tre stegen", async () => {
    const friskrivningen = renderToStaticMarkup(createElement(Friskrivning)).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    expect(friskrivningen, "förutsättningen: friskrivningen har en text").toMatch(/skatterådgivning/);
    const sidan = () => (behallare.textContent ?? "").replace(/\s+/g, " ");

    await rendera();
    expect(framsteg()).toBe("1 av 3");
    expect(sidan()).not.toContain(friskrivningen);

    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    // Förutsättningen: frågorna står på skärmen – där raden stod.
    expect(framsteg()).toBe("2 av 3");
    expect(synligText()).toContain("Byggde du något nytt som inte fanns tidigare?");
    expect(sidan()).not.toContain(friskrivningen);
    expect(sidan()).not.toContain("upplysningstjänst");

    await svaraUtbyttLiknande();
    await tryck("Nästa");
    expect(framsteg()).toBe("3 av 3");
    expect(sidan()).not.toContain(friskrivningen);
  });
});

/** Raden om Skatteverkets regler ur docs/design.md – läst i provet, inte på modulnivå. */
function radenOmReglerna(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(/\*\*Lydelsen är fastställd 2026-11-22:\*\* \*"([^"]+)"\*/);
  if (!m) throw new Error("design.md saknar lydelsen för raden om Skatteverkets regler");
  return m[1];
}

describe("raden om Skatteverkets regler står en gång, i första steget", () => {
  it("i steg 1 och inte i steg 2 eller 3", async () => {
    const raden = radenOmReglerna();
    // Elementets hela text, inte en delsträng, och bara element som står på skärmen.
    const traffar = () =>
      [...behallare.querySelectorAll("p")]
        .filter((p) => !p.closest("[hidden]"))
        .filter((p) => (p.textContent ?? "").replace(/\s+/g, " ").trim() === raden).length;

    await rendera();
    expect(framsteg()).toBe("1 av 3");
    expect(traffar(), "steg 1").toBe(1);

    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    expect(framsteg()).toBe("2 av 3");
    expect(synligText()).toContain("Byggde du något nytt som inte fanns tidigare?");
    expect(traffar(), "steg 2").toBe(0);
    // Inte heller dold i trädet: raden står bara i steg 1.
    expect((behallare.textContent ?? "").replace(/\s+/g, " ")).not.toContain(raden);

    await svaraUtbyttLiknande();
    await tryck("Nästa");
    expect(framsteg()).toBe("3 av 3");
    expect(traffar(), "steg 3").toBe(0);
    expect((behallare.textContent ?? "").replace(/\s+/g, " ")).not.toContain(raden);
  });
});
