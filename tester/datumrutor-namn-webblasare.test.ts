import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";
import { paketera } from "./_paketera";

// De tre datumrutorna bär fältets namn (docs/design.md, "De tre rutorna
// måste bära fältets namn"). Rutorna hette "År", "Månad" och "Dag", och de
// namnen tog över fältets etikett: i tillgänglighetsträdet stod ordet
// Betaldatum ingenstans, och formulärets två datumfält gick inte att skilja åt.
//
// Mätmetoden, så att nästa mätning går att jämföra med den här: varje skärm
// renderas i en headless Chrome och trädet läses med CDP:s
// Accessibility.getFullAXTree. Rutorna är de noder med rollen textbox vars
// DOM-nod ligger i ett datumfält (en etikett med en ruta för året) – inte
// de noder vars namn råkar innehålla "år". Det väntade namnet byggs ur
// etiketten som syns på skärmen. Ingen riktig skärmläsare används; trädet är
// det skärmläsaren får, inte det den säger.
//
// Skärmarna är alla platser i src/ där ett datumfält används. Listan prövas
// mot koden längst ned, så att en ny plats faller i stället för att saknas.

/** Varje skärm: filen den bor i, och komponenten renderad som appen gör det. */
const SKARMAR: Record<string, { fil: string; ingang: string }> = {
  inmatningen: {
    fil: "src/app/kostnad/nytt/form.tsx",
    ingang: `
import { NyKostnadForm } from "@/app/kostnad/nytt/form";
rendera(<NyKostnadForm
  bostad={{ id: "b0000000-0000-4000-8000-000000000096", namn: null }}
  innehav={{ tilltradesdatum: "2025-06-01", forsaljningsdatum: null }}
  utkast={{
    id: "k0000000-0000-4000-8000-000000000096",
    anteckning: "Trappan",
    falt: { belopp: "8 500,00", datum: "2026-01-08", dokumentdatum: "2025-12-28", leverantor: "Snickeri Nord AB", rot: "1 800,00" },
    bilagor: [],
  }}
/>);`,
  },
  andringslaget: {
    fil: "src/app/kostnad/[id]/kvitto-kort.tsx",
    ingang: `
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";
rendera(<RedigeraVy
  kostnadId="k0000000-0000-4000-8000-000000000096"
  projekt={[]}
  varden={{ leverantor: "Snickeri Nord AB", totalbelopp: "8 500,00", totalbeloppVisning: 850000, dokumentdatum: "2025-12-28",
    betaldatum: "2026-01-08", projektId: "", rotUtnyttjat: "1 800,00", anteckning: "Trappan" }}
  innehav={{ tilltradesdatum: "2025-06-01", forsaljningsdatum: null }}
  privatDel={null}
  arkiverad={false}
  onAvbryt={() => {}}
  onSparat={() => {}}
/>);`,
  },
  registreringen: {
    fil: "src/app/registrera/flode.tsx",
    ingang: `
import { RegistreraFlode } from "@/app/registrera/flode";
rendera(<RegistreraFlode endastBostad />);`,
  },
  installningarna: {
    fil: "src/app/installningar/kort.tsx",
    ingang: `
import { createRef } from "react";
import { ForvarvetKort } from "@/app/installningar/kort";
rendera(<ForvarvetKort
  data={{ tilltradesdatum: "2025-06-01", kopeskillingOren: 300000000n, kopkostnaderOren: null, arBostadsratt: false,
    agarandelProcent: 100, bostadsfragor: { upplatelseform: "fastighet", forstaAgare: false, ombildning: null } }}
  oppen formRef={createRef()} onAndra={() => {}} onAvbryt={() => {}} onDirty={() => {}} onKlar={() => {}}
/>);`,
  },
  forsaljningen: {
    fil: "src/app/forsaljning/form.tsx",
    ingang: `
import { ForsaljningForm } from "@/app/forsaljning/form";
rendera(<ForsaljningForm forvaltDatum="2026-10-01" forvaltPris="" redanSald={false} />);`,
  },
};

/** Antalet datumfält varje skärm ska visa – förutsättningen för mätningen. */
const ANTAL_DATUMFALT: Record<string, number> = {
  inmatningen: 2, andringslaget: 2, registreringen: 1, installningarna: 1, forsaljningen: 1,
};

let webblasare: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för tillgänglighetsträdet – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const sidor: Record<string, string> = {};
  for (const [namn, { ingang }] of Object.entries(SKARMAR)) {
    const skript = await paketera(`
import { createRoot } from "react-dom/client";
window.__inskickat = [];
const rendera = (e) => createRoot(document.getElementById("rot")).render(e);
${ingang}`);
    sidor[namn] = `<!doctype html><html lang="sv"><head><meta charset="utf-8"></head>
<body><div id="rot"></div>
<script>window.process = { env: {} };</script>
<script>${skript.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
  }
  // Next skriver in process.env.NEXT_PUBLIC_* vid bygget; paketeringen gör
  // det inte, och registreringens adressfält läser en sådan nyckel när
  // modulen laddas. Ett tomt process.env är samma sak som en nyckel som
  // inte är satt.
  webblasare = await startaWebblasare(sidor, "kvittobo-datumrutor-");
}, 120_000);

afterAll(async () => {
  await webblasare?.stang();
});

interface AXNod {
  role?: { value?: string };
  name?: { value?: string };
  backendDOMNodeId?: number;
}

interface Datumfalt {
  /** Etiketten som syns, utan obligatoriskt-markeringen. */
  etikett: string;
  /** Rutornas namn i tillgänglighetsträdet, i ordning. */
  rutor: string[];
}

/** Öppnar skärmen och läser varje datumfälts rutor ur tillgänglighetsträdet. */
async function datumfalten(skarm: string): Promise<Datumfalt[]> {
  await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}${skarm}` });
  for (let i = 0; i < 50; i++) {
    const klar = await webblasare.utvardera<boolean>(`document.querySelector('input[inputmode="numeric"][placeholder="ÅÅÅÅ"]') !== null`);
    if (klar) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  // Märk varje ruta i DOM med sitt fält och sin plats, så att trädets noder
  // kan föras till rätt fält via sin DOM-nod.
  const falt = await webblasare.utvardera<{ etikett: string }[]>(`(() => {
    const falt = [...document.querySelectorAll("label")]
      .filter((l) => l.querySelector('input[placeholder="ÅÅÅÅ"]') && l.closest("[hidden]") === null);
    return falt.map((l, i) => {
      l.querySelectorAll("input:not([type=hidden])").forEach((r, j) => r.setAttribute("data-matning", i + ":" + j));
      return { etikett: l.querySelector("span").textContent.replace(/\\*$/, "").trim() };
    });
  })()`);
  await webblasare.cdp("DOM.getDocument", { depth: -1 });
  await webblasare.cdp("Accessibility.enable");
  const { nodes } = await webblasare.cdp<{ nodes: AXNod[] }>("Accessibility.getFullAXTree");
  const rutor: string[][] = falt.map(() => []);
  for (const n of nodes) {
    if (n.role?.value !== "textbox" || n.backendDOMNodeId === undefined) continue;
    const { object } = await webblasare.cdp<{ object: { objectId: string } }>("DOM.resolveNode", { backendNodeId: n.backendDOMNodeId });
    const { result } = await webblasare.cdp<{ result: { value: string | null } }>("Runtime.callFunctionOn", {
      objectId: object.objectId,
      functionDeclaration: "function () { return this.getAttribute('data-matning'); }",
      returnByValue: true,
    });
    if (result.value === null) continue;
    const [i, j] = result.value.split(":").map(Number);
    rutor[i][j] = n.name?.value ?? "";
  }
  return falt.map((f, i) => ({ etikett: f.etikett, rutor: rutor[i] }));
}

describe("datumrutorna i tillgänglighetsträdet, i Chrome", () => {
  it.each(Object.keys(SKARMAR))("%s: varje ruta bär fältets namn och sin egen del", async (skarm) => {
    const falt = await datumfalten(skarm);
    expect(falt.length, `${skarm}: antalet datumfält`).toBe(ANTAL_DATUMFALT[skarm]);
    for (const f of falt) {
      expect(f.etikett, `${skarm}: ett datumfält utan etikett`).not.toBe("");
      expect(f.rutor, `${skarm}: rutorna i fältet ${f.etikett}`).toEqual([
        `${f.etikett}, år`, `${f.etikett}, månad`, `${f.etikett}, dag`,
      ]);
    }
  }, 60_000);

  it("inmatningen: de två datumfältens rutor går att skilja åt", async () => {
    const [betaldatum, kvittodatum] = await datumfalten("inmatningen");
    expect([betaldatum.etikett, kvittodatum.etikett]).toEqual(["Betaldatum", "Kvittots datum"]);
    const gemensamma = betaldatum.rutor.filter((n) => kvittodatum.rutor.includes(n));
    expect(gemensamma, "rutor med samma namn i båda fälten").toEqual([]);
  }, 60_000);
});

describe("listan över skärmar är hela", () => {
  it("varje fil i src/ som använder DatumFalt mäts ovan", () => {
    const rot = process.cwd();
    const filer: string[] = [];
    const ga = (katalog: string) => {
      for (const namn of readdirSync(katalog)) {
        const fil = join(katalog, namn);
        if (statSync(fil).isDirectory()) ga(fil);
        else if (/\.tsx$/.test(namn) && readFileSync(fil, "utf8").includes("<DatumFalt")) filer.push(relative(rot, fil));
      }
    };
    ga(join(rot, "src"));
    expect(filer.length, "förutsättningen: DatumFalt hittades i src/").toBeGreaterThan(0);
    expect(filer.sort()).toEqual(Object.values(SKARMAR).map((s) => s.fil).sort());
  });
});
