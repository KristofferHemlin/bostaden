// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Projektflödet, provat pa det som renderas (docs/design.md, "Att skapa ett
// projekt"). Den riktiga sidan kors mot en falsk databas och renderas hel i
// en DOM; bara server-actionen ar utbytt, sa att testet ser vad som skickas.
//
//   1. Ordningen: vad gjorde du → vilken del av bostaden → fragetradet →
//      vilka kvitton hörde hit. Framsteget ar "N av 4", utan ordet fore, och
//      ingenstans star hur manga fragorna ar.
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

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import NyttProjektSida from "@/app/projekt/nytt/page";
import { utkastNyckel } from "@/app/projekt/nytt/flode";
import { BOSTADSDEL_FRAGA } from "@/doman/bostadsdel";
import { merkostnadOverBeloppetFel, tolkaFragetradetFormData } from "@/lib/fragetradet-formdata";

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
  it("namnet, bostadsdelen, frågeträdet, kvittona – som 1 av 4 till 4 av 4", async () => {
    await rendera();
    expect(framsteg()).toBe("1 av 4");
    expect(synligText()).toContain("Vad gjorde du?");
    expect(synligText()).not.toContain(BOSTADSDEL_FRAGA);

    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    expect(framsteg()).toBe("2 av 4");
    expect(synligText()).toContain(BOSTADSDEL_FRAGA);
    expect(synligText()).not.toContain("Vad gjorde du?");

    await tryck("Nästa");
    expect(framsteg()).toBe("3 av 4");
    expect(synligText()).toContain("Byggde du något nytt som inte fanns tidigare?");

    await svaraUtbyttLiknande();
    await tryck("Nästa");
    expect(framsteg()).toBe("4 av 4");
    const rubrik = [...behallare.querySelectorAll("legend")].find(synlig)!;
    expect(rubrik.textContent).toBe("Vilka kvitton hörde till ”Måla sovrummet”?");
    expect([...behallare.querySelectorAll('input[type="checkbox"]')].filter(synlig)).toHaveLength(1);
  });

  it("skicket vid förvärvet ställs när något byttes ut, och inte när det byggdes nytt", async () => {
    await rendera();
    await skrivNamn("Ny altan");
    await tryck("Nästa");
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

describe("varje steg prövas innan nästa", () => {
  it("ett tomt namn stoppar vid namnet, med serverns lydelse", async () => {
    await rendera();
    await tryck("Nästa");
    const vantat = tolkaFragetradetFormData(new FormData(), { belopp: 0 });
    expect("fel" in vantat && vantat.falt).toBe("namn");
    expect(synligaLarm()).toEqual(["fel" in vantat ? vantat.fel : ""]);
    expect(framsteg()).toBe("1 av 4");
  });

  it("en obesvarad fråga stoppar i frågeträdet", async () => {
    await rendera();
    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    await tryck("Nästa");
    await tryck("Nästa");
    expect(framsteg()).toBe("3 av 4");
    expect(synligaLarm()).toEqual(["Svara på om du byggde något nytt."]);
  });
});

describe("tillståndet mellan stegen", () => {
  it("ingenting skickas förrän Spara, och då allt på en gång", async () => {
    await rendera();
    await skrivNamn("Måla sovrummet");
    await tryck("Nästa");
    await tryck("Ytskikt");
    await tryck("Nästa");
    await svaraUtbyttLiknande();
    await tryck("Nästa");
    expect(h.skapaProjekt).not.toHaveBeenCalled();

    await act(async () => behallare.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await act(async () => knapp("Spara").closest("form")!.requestSubmit(knapp("Spara")));
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
    await tryck("Nästa");
    await tryck("Ytskikt");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");

    // Hon lämnar sidan – flödet tas bort – och öppnar den igen.
    act(() => rot.unmount());
    rot = createRoot(behallare);
    await rendera();

    expect(framsteg()).toBe("3 av 4");
    expect(knapp("Ja, det är helt nytt").getAttribute("aria-pressed")).toBe("true");
    await tryck("Tillbaka");
    expect(knapp("Ytskikt").getAttribute("aria-pressed")).toBe("true");
    await tryck("Tillbaka");
    expect(behallare.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("Måla sovrummet");
    expect(h.skapaProjekt).not.toHaveBeenCalled();
  });

  it("ett flöde ingen rört lämnar inget utkast", async () => {
    await rendera();
    await tryck("Nästa");
    expect(window.localStorage.getItem(utkastNyckel(X))).toBeNull();
  });

  it("när projektet sparats är utkastet borta och hon hamnar på projektet", async () => {
    h.skapaProjekt.mockResolvedValue({ skapat: "c0000000-0000-4000-8000-0000000000d9" });
    await rendera();
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    await tryck("Nästa");
    expect(window.localStorage.getItem(utkastNyckel(X))).not.toBeNull();
    await act(async () => knapp("Spara").closest("form")!.requestSubmit(knapp("Spara")));
    expect(window.localStorage.getItem(utkastNyckel(X))).toBeNull();
    expect(h.ersatt).toHaveBeenCalledWith("/projekt/c0000000-0000-4000-8000-0000000000d9");
  });
});

/** Svarar fram till fråga 5 = bättre kvalitet och skick 1, med namnet satt. */
async function svaraBattre() {
  await skrivNamn("Måla sovrummet");
  await tryck("Nästa");
  await tryck("Nästa");
  await tryck("Nej");
  const nej = [...behallare.querySelectorAll("button")].filter((b) => synlig(b) && b.textContent === "Nej");
  await act(async () => nej[1].click());
  await tryck("Jag bytte ut något som fanns");
  await tryck("Bättre kvalitet");
  await tryck("1 – Dåligt skick");
}

/** Det synliga merkostnadsfältet, eller null. */
function merkostnadsfalt(): HTMLInputElement | null {
  return (
    [...behallare.querySelectorAll<HTMLInputElement>("input")].find(
      (i) => synlig(i) && i.placeholder === "t.ex. 500",
    ) ?? null
  );
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
  await act(async () => knapp("Spara").closest("form")!.requestSubmit(knapp("Spara")));
}

// Merkostnaden är den enda frågan som behöver ett belopp, och den ställs
// därför bara när det finns ett (docs/design.md, "Att skapa ett projekt").
// I flödet finns beloppet först när kvittona valts, i sista steget.
describe("merkostnaden ställs när det finns ett belopp att dela", () => {
  it("inte i frågeträdet, och i kvittosteget först när ett kvitto med belopp är valt", async () => {
    await rendera();
    await svaraBattre();
    expect(framsteg()).toBe("3 av 4");
    expect(merkostnadsfalt(), "inget merkostnadsfält i frågeträdet").toBeNull();
    await tryck("Nästa");
    expect(framsteg()).toBe("4 av 4");
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
    expect(framsteg()).toBe("4 av 4");
    expect(synligaLarm()).toEqual([
      "Ange en merkostnad större än 0 kr – bättre kvalitet innebär att bytet kostade mer.",
    ]);

    // 791,95 kr är vad målningsraderna kostade – torkstället var privat.
    await skriv(merkostnadsfalt()!, "791,95");
    await spara();
    expect(h.skapaProjekt).not.toHaveBeenCalled();
    expect(framsteg()).toBe("4 av 4");
    expect(synligaLarm()).toEqual([merkostnadOverBeloppetFel("Måla sovrummet", 79_195)]);

    await skriv(merkostnadsfalt()!, "791,94");
    await spara();
    expect(h.skapaProjekt).toHaveBeenCalledTimes(1);
    expect(h.skapaProjekt.mock.calls[0][1].get("merkostnad")).toBe("791,94");
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
    await tryck("Nästa");
    await tryck("Ytskikt");
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    await lamnaOchKomTillbaka();

    expect(synligText()).toContain(UTKASTET);
    expect(framsteg()).toBe("3 av 4");
    await tryck("Börja om");

    expect(framsteg()).toBe("1 av 4");
    expect(behallare.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe("");
    expect(synligText()).not.toContain(UTKASTET);
    expect(window.localStorage.getItem(utkastNyckel(X))).toBeNull();
    // Inget av de gamla svaren ligger kvar dolt.
    await skrivNamn("Ny altan");
    await tryck("Nästa");
    expect(knapp("Ytskikt").getAttribute("aria-pressed")).toBe("false");
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
  it("ett saknat skick vid förvärvet skickar tillbaka till frågeträdet", async () => {
    window.localStorage.setItem(
      utkastNyckel(X),
      JSON.stringify({
        steg: 4,
        namn: "Måla sovrummet",
        bostadsdelar: [],
        svar: {
          byggdeNytt: "nej", andradePlanlosning: "nej", nyttEllerBytt: "bytt",
          battreEllerLiknande: "liknande", merkostnad: null, merkostnadText: "",
          skickForvarv: "", motivering: "",
        },
        valda: [],
      }),
    );
    await rendera();
    expect(framsteg()).toBe("4 av 4");
    await spara();
    expect(h.skapaProjekt).not.toHaveBeenCalled();
    expect(framsteg()).toBe("3 av 4");
    expect(synligaLarm()).toEqual(["Ange skicket vid förvärvet, 0–5."]);
  });
});
