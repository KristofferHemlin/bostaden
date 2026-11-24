import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Ett besked i felets ton läses upp (CLAUDE.md, "Ett besked som bara bärs av
// en färg finns inte"; uppräkningen 2026-11-24). Uppräkningen görs ur koden:
// varje JSX-tagg vars className bär --accent som textfärg (text-accent eller
// FALTFEL_KLASS) ska ha role="alert" eller role="status" – annars hörs ett fel
// som syns. Varje undantag bär sitt skäl.
//
// Det här är en läsning av källan, inte av det som renderas: påståendet är att
// attributet finns på elementet, och de flesta av beskeden kräver ett
// serversvar för att alls visas. Var och en av de nio som fick attributet
// 2026-11-24 bröts med flit och fällde provet.

const ROT = process.cwd();

const UNDANTAG: Record<string, string> = {
  // Färgen förstärker; meningen vid fältet bär beskedet och har role="alert".
  "src/app/installningar/dela-bostaden.tsx#tabular-nums": "summan vid inbjudan – meningen vid fältet läses upp",
  "src/app/forsaljning/andel/form.tsx#tabular-nums": "summan vid försäljningen – meningen vid fältet läses upp",
  // Bakom BILAGEPAKET_SYNLIGT, som är av: ingen användare når dem.
  "src/app/export/paket/flode.tsx#": "bilagepaketet, bakom en avstängd flagga",
};

function filer(katalog: string): string[] {
  return readdirSync(katalog).flatMap((n) => {
    const p = join(katalog, n);
    return statSync(p).isDirectory() ? filer(p) : n.endsWith(".tsx") ? [p] : [];
  });
}

/** Behållare som ger sin ton åt en mening inuti, och där meningen – inte
 *  behållaren – bär rollen, eftersom behållaren också har en knapp. Provet
 *  kräver att första taggen inuti har role="alert". */
const BEHALLARE: Record<string, string> = {
  "src/app/kostnad/[id]/bilagor.tsx#mt-2 font-granssnitt": "uppladdningsfelet på kvittots sida, med Försök igen bredvid",
};

interface Tagg {
  fil: string;
  rad: number;
  text: string;
  /** Första öppningstaggen efter den här. */
  nasta: string | null;
}

/** Öppningstaggen som börjar vid `start`, till det `>` som står utanför
 *  klamrar och strängar. Ett mönster utan klamrar räcker inte: en className
 *  som `summa > HOGSTA ? … : …` bär ett `>` mitt i taggen, och 2026-11-24
 *  missade ett sådant mönster just de två summorna. */
function oppningstagg(kalla: string, start: number): string | null {
  let djup = 0;
  let strang: string | null = null;
  for (let i = start + 1; i < kalla.length; i++) {
    const c = kalla[i];
    if (strang) {
      if (c === "\\") i++;
      else if (c === strang) strang = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") strang = c;
    else if (c === "{") djup++;
    else if (c === "}") djup--;
    else if (c === ">" && djup === 0) return kalla.slice(start, i + 1);
    else if (c === "<" && djup === 0) return null;
  }
  return null;
}

/** Varje öppningstagg med felets ton som textfärg. */
function taggar(): Tagg[] {
  return filer(join(ROT, "src")).flatMap((f) => {
    const kalla = readFileSync(f, "utf-8");
    const ut: Tagg[] = [];
    for (const m of kalla.matchAll(/<[a-z][a-zA-Z]*[\s>]/g)) {
      const text = oppningstagg(kalla, m.index!);
      if (!text || !/\btext-accent\b(?!-)|\{FALTFEL_KLASS\}|\$\{FALTFEL_KLASS\}/.test(text)) continue;
      const efter = m.index! + text.length;
      const n = kalla.slice(efter).match(/<[a-z][a-zA-Z]*[\s>]/);
      const nasta = n ? oppningstagg(kalla, efter + n.index!) : null;
      ut.push({ fil: f.slice(ROT.length + 1), rad: kalla.slice(0, m.index).split("\n").length, text, nasta });
    }
    return ut;
  });
}

const traffar = (tabell: Record<string, string>, t: Tagg) =>
  Object.entries(tabell).find(([nyckel]) => {
    const [fil, del] = nyckel.split("#");
    return t.fil === fil && t.text.includes(del);
  })?.[1];
const undantag = (t: Tagg) => traffar(UNDANTAG, t);
/** En behållare godkänns bara när meningen inuti verkligen har rollen. */
const behallareMedRoll = (t: Tagg) => traffar(BEHALLARE, t) !== undefined && /\brole="alert"/.test(t.nasta ?? "");

describe("varje besked i felets ton läses upp", () => {
  it("uppräkningen hittar beskeden – förutsättningen för att den säger något", () => {
    const t = taggar();
    expect(t.length, "taggar med felets ton").toBeGreaterThanOrEqual(20);
    // Filerna med de nio som fick rollen 2026-11-24 ska vara med.
    for (const fil of [
      "src/app/installningar/arkivexport-knapp.tsx",
      "src/app/kostnad/utkast-radera.tsx",
      "src/app/kostnad/[id]/bilagor.tsx",
      "src/components/bostadsvaxlare.tsx",
      "src/components/bostadsfragor-formular.tsx",
      "src/app/kostnad/nytt/form.tsx",
      "src/app/inbjudan/anslut-knapp.tsx",
      "src/app/installningar/dela-bostaden.tsx",
    ]) {
      expect(t.some((x) => x.fil === fil), fil).toBe(true);
    }
  });

  it("har role=alert eller role=status, eller ett skrivet skäl att inte ha det", () => {
    const utan = taggar()
      .filter((t) => !/\brole="(alert|status)"/.test(t.text) && !undantag(t) && !behallareMedRoll(t))
      .map((t) => `${t.fil}:${t.rad}`);
    expect(utan).toEqual([]);
  });

  it("varje undantag gäller något som finns", () => {
    const t = taggar();
    for (const [nyckel, skal] of Object.entries({ ...UNDANTAG, ...BEHALLARE })) {
      const [fil, del] = nyckel.split("#");
      expect(t.some((x) => x.fil === fil && x.text.includes(del)), `${nyckel} (${skal})`).toBe(true);
    }
  });
});
