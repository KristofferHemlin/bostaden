// @vitest-environment jsdom
// Ett kvittoutkast minns det hon skrev (docs/design.md). Forloppet som
// mattes 2026-11-20: avlasningen fyller i 61 812,50 kr och Maskinens AB, hon
// rattar till 60 812,50 kr och Byggfirman AB, skriver en mening i "Vad gällde
// det?" (anteckningen, tillagd 2026-11-20 i nasta omgang), stanger direkt, och oppnar
// utkastet igen. Da var falten tomma om markeringen av bilagan lyckats, och
// maskinens gissning tillbaka om den misslyckats.
//
// Hela vagen ar den riktiga: sidan (page.tsx) som laser utkastet, formularet,
// sparaUtkastfalten och analyseraKostnadsbilaga. Falskt ar bara databasen
// (en rad och en bilaga, dar markeringen kan fas att misslyckas), modellen,
// lagringen och sessionen.
//
// Stangningen sker direkt efter rattelsen, inom det lopande sparandets
// vantan – det ar formularets sandning nar det lamnas som bar falten dit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: null as null | {
    kostnad: Record<string, unknown> & { id: string; totalbelopp: number | null };
    bilaga: { id: string; dokument_analyserad: boolean };
  },
  markeringFaller: false,
  modellanrop: 0,
  sentry: [] as string[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (u: string) => { throw new Error(`redirect ${u}`); },
  notFound: () => { throw new Error("notFound"); },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortBilagaAction: vi.fn(async () => ({})),
  taBortKostnad: vi.fn(async () => ({})),
  taBortUtkastRad: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: vi.fn() }));
vi.mock("@/lib/session", () => ({
  kravBostad: async () => ({ bostadId: "bo1", anvandareId: "a1", antalBostader: 1 }),
  bostadForKostnad: async (id: string) => (id === "k1" ? "bo1" : null),
  kravMedlemskapI: async () => ({ bostadId: "bo1", anvandareId: "a1" }),
}));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: async ({ bilagaId }: { bilagaId: string }) =>
    (await import("@/lib/dokumentavlasning/lagring")).analyseraKostnadsbilaga({ bostadId: "bo1", bilagaId }),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
  begarBilagauppladdning: vi.fn(async () => ({})),
  bekraftaBilagauppladdning: vi.fn(async () => ({})),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({
  analyseraDokumentbuffert: async () => {
    h.modellanrop++;
    return { kord: true, falt: { totalbelopp: 6181250, leverantor: "Maskinens AB", betaldatum: "2026-10-01", dokumentdatum: "2026-10-01", rot_utnyttjat: null } };
  },
}));
vi.mock("@/lib/feltrapportering", () => ({
  rapporteraFel: (f: unknown, s: { anrop?: string }) => { h.sentry.push(`${s.anrop}: ${String(f)}`); },
}));
vi.mock("@/lib/lagring/klient", () => ({
  bilagelager: () => ({
    download: async () => ({ data: { arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer }, error: null }),
    createSignedUrl: async () => ({ data: { signedUrl: "about:blank" }, error: null }),
  }),
  BILAGOR_BUCKET: "b",
}));
vi.mock("@/lib/lagring/bildmatt", () => ({ lasBildmatt: vi.fn() }));
vi.mock("@/lib/lagring/miniatyr", () => ({ heicTillJpeg: vi.fn(), skalaTillMiniatyr: vi.fn() }));
vi.mock("@/lib/lagring/pdf-sidor", () => ({ lasPdfInfo: vi.fn() }));
vi.mock("@/lib/lagring/visning", () => ({ skalaTillVisningsversion: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bostad: {
      findUniqueOrThrow: async () => ({
        id: "bo1", adress: "Testgatan 1", upplatelseform: "bostadsratt",
        tilltradesdatum: new Date("2020-01-01"), forsaljningsdatum: null,
      }),
    },
    kostnad: {
      findFirst: async ({ select }: { select: Record<string, boolean> }) =>
        Object.fromEntries(Object.keys(select).map((k) => [k, h.db!.kostnad[k]])),
      findUnique: async () => ({ id: h.db!.kostnad.id, totalbelopp: h.db!.kostnad.totalbelopp }),
      updateMany: async ({ where, data }: { where: { id: string; totalbelopp?: null }; data: Record<string, unknown> }) => {
        const k = h.db!.kostnad;
        if (k.id !== where.id || ("totalbelopp" in where && k.totalbelopp !== null)) return { count: 0 };
        Object.assign(k, data);
        return { count: 1 };
      },
    },
    bilaga: {
      findUnique: async () => ({
        lagringsnyckel: "bo1/k1/x.jpg", filnamn: "kvitto.jpg", mimetyp: "image/jpeg",
        dokument_analyserad: h.db!.bilaga.dokument_analyserad, kostnad: { bostad_id: "bo1" },
      }),
      update: async ({ data }: { data: { dokument_analyserad: boolean } }) => {
        if (h.markeringFaller) throw new Error("db nere");
        h.db!.bilaga.dokument_analyserad = data.dokument_analyserad;
        return {};
      },
      findMany: async () => [
        {
          id: h.db!.bilaga.id, bredd: 600, hojd: 800, filnamn: "kvitto.jpg", mimetyp: "image/jpeg",
          miniatyrnyckel: null, dokument_analyserad: h.db!.bilaga.dokument_analyserad, sidantal: null,
        },
      ],
    },
  },
}));

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import NyKostnadSida from "@/app/kostnad/nytt/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  h.db = {
    kostnad: {
      id: "k1", totalbelopp: null, utkast_belopp: null, leverantor: null, dokumentdatum: null,
      betaldatum: null, rot_utnyttjat: null, anteckning: null,
    },
    bilaga: { id: "b1", dokument_analyserad: false },
  };
  h.modellanrop = 0;
  h.sentry = [];
});
afterEach(() => behallare?.remove());

/** Den riktiga sidan med ?utkast=k1. Formularet ar Skarm-elementets barn. */
async function oppnaUtkastet() {
  const sida = (await NyKostnadSida({ searchParams: Promise.resolve({ utkast: "k1" }) })) as ReactElement<{ children: ReactElement }>;
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () => rot.render(sida.props.children));
  for (let i = 0; i < 30; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
const belopp = () => behallare.querySelector<HTMLInputElement>('input[name="totalbelopp"]')!;
const varde = (el: HTMLInputElement) => el.value.replace(/\s/g, " ");
const leverantor = () => behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!;
const anteckningen = () => behallare.querySelector<HTMLTextAreaElement>('textarea[name="anteckning"]')!;
const MENINGEN = "Altanbygget, andra fakturan: snickeriet och virket till trappan";
async function skriv(el: HTMLInputElement | HTMLTextAreaElement, varde: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const satt = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  await act(async () => {
    satt.call(el, varde);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
/** Stanger direkt efter rattelsen – inom det lopande sparandets vantan. */
async function stang() {
  await act(async () => rot.unmount());
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  behallare.remove();
}

for (const markeringFaller of [true, false]) {
  describe(`markeringen ${markeringFaller ? "misslyckas" : "lyckas"}`, () => {
    it("rattelse, stang, oppna igen", async () => {
      h.markeringFaller = markeringFaller;
      await oppnaUtkastet();
      const forst = { belopp: varde(belopp()), leverantor: leverantor().value, anrop: h.modellanrop };
      expect(forst.anrop, "modellen anropades inte vid forsta oppningen").toBe(1);
      expect(forst.belopp, "avlasningen fyllde inte i beloppet").toBe("61 812,50");
      await skriv(belopp(), "60 812,50");
      await skriv(leverantor(), "Byggfirman AB");
      await skriv(anteckningen(), MENINGEN);
      await stang();
      const db = { ...h.db!.kostnad, analyserad: h.db!.bilaga.dokument_analyserad };
      await oppnaUtkastet();
      const igen = {
        belopp: varde(belopp()), leverantor: leverantor().value, anteckning: anteckningen().value,
        anrop: h.modellanrop, sentry: h.sentry,
      };
      // Hennes tal, i databasen och i formularet – och fortfarande ett utkast.
      expect(db).toMatchObject({
        totalbelopp: null, utkast_belopp: 6_081_250, leverantor: "Byggfirman AB", anteckning: MENINGEN,
      });
      expect(igen.belopp).toBe("60 812,50");
      expect(igen.leverantor).toBe("Byggfirman AB");
      expect(igen.anteckning).toBe(MENINGEN);
      // Avlasningen kordes inte om: nagot var ifyllt, aven nar bilagan
      // fortfarande ar omarkerad.
      expect(igen.anrop, "avlasningen kordes om").toBe(1);
      // En misslyckad markering rapporteras; en lyckad gor det inte.
      expect(igen.sentry).toEqual(
        markeringFaller ? ["analyseraKostnadsbilaga (markeringen): Error: db nere"] : [],
      );
    });
  });
}
