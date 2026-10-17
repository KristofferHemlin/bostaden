import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  KOPIERINGSINTERVALL_DAGAR,
  LOFTE_DAGAR,
  RENSNINGSGRANS_DAGAR,
  planeraRensning,
  rensaSakerhetskopior,
  tolkaKopia,
  type Kopia,
} from "@/lib/sakerhetskopior/rensning";

// Integritetspolicyn, avsnitt 6: raderar du ditt konto forsvinner uppgifterna
// ur kopiorna nar dessa rensas, senast LOFTE_DAGAR efter raderingen. En obegransad
// kopia kan inte samexistera med ett loftet om radering – darfor rensas bade
// veckokopiorna och raderingskommandots egna kopior.

const NU = new Date(2026, 9, 17, 12, 0, 0); // lokal tid, som katalognamnen
const dagarSedan = (d: number) => new Date(NU.getTime() - d * 86_400_000);
function namn(prefix: string, d: Date, suffix = ""): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${suffix}`;
}
const vecka = (d: number, suffix = "") => namn("bostadsunderlag", dagarSedan(d), suffix);
const radering = (d: number) => `${namn("radering", dagarSedan(d))}-a1b2c3d4`;
const kopior = (...namnen: string[]) => namnen.map((n) => tolkaKopia(n)).filter((k): k is Kopia => k !== null);

describe("tolkaKopia", () => {
  it("kanner igen veckokopior, ofullstandiga veckokopior och raderingskopior", () => {
    expect(tolkaKopia("bostadsunderlag-2026-09-30_115118")).toEqual({
      namn: "bostadsunderlag-2026-09-30_115118",
      sort: "veckokopia",
      tagen: new Date(2026, 8, 30, 11, 51, 18),
      fullstandig: true,
    });
    expect(tolkaKopia("bostadsunderlag-2026-09-30_115118-MISSLYCKAD")?.fullstandig).toBe(false);
    expect(tolkaKopia("bostadsunderlag-2026-09-30_115118-pagaende")?.fullstandig).toBe(false);
    expect(tolkaKopia("radering-2026-10-01_090000-a1b2c3d4")?.sort).toBe("raderingskopia");
  });

  it("ror aldrig nagot den inte kanner igen", () => {
    for (const n of ["anteckningar.txt", "bostadsunderlag", "bostadsunderlag-2026-13-40_999999", "annat-2026-09-30_115118", ".DS_Store"]) {
      expect(tolkaKopia(n), n).toBeNull();
    }
  });
});

describe("gransen", () => {
  // Rensningen kors bara nar kopieringen kors. En kopia som ar en dag for ung
  // vid en korning hinner bli KOPIERINGSINTERVALL_DAGAR aldre innan nasta –
  // gransen plus intervallet maste darfor rymmas inom loftet. Det ar det har
  // testet som faller om nagon satter gransen till loftet for att 23 ser fel ut.
  it("haller loftet aven nar en kopia just missat en rensning", () => {
    expect(RENSNINGSGRANS_DAGAR + KOPIERINGSINTERVALL_DAGAR).toBeLessThanOrEqual(LOFTE_DAGAR);
  });

  it("loftet ar 30 dagar och kopieringen kors varje vecka", () => {
    expect(LOFTE_DAGAR).toBe(30);
    expect(KOPIERINGSINTERVALL_DAGAR).toBe(7);
  });
});

describe("planeraRensning", () => {
  const G = RENSNINGSGRANS_DAGAR;

  it("raderar det som natt gransen, av bada sorterna, och behaller resten", () => {
    const plan = planeraRensning(
      kopior(vecka(2), vecka(G - 1), vecka(G), vecka(45, "-MISSLYCKAD"), radering(G + 1), radering(10)),
      NU,
    );
    expect(plan.raderas.map((k) => k.namn).sort()).toEqual([vecka(G), vecka(45, "-MISSLYCKAD"), radering(G + 1)].sort());
    expect(plan.behalls.map((k) => k.namn).sort()).toEqual([vecka(2), vecka(G - 1), radering(10)].sort());
    expect(plan.sparrade).toEqual([]);
  });

  it("raderar aldrig den sista hela veckokopian – utan en farsk hel kopia sparras de gamla", () => {
    const plan = planeraRensning(kopior(vecka(40), vecka(33), vecka(5, "-MISSLYCKAD"), radering(35)), NU);
    expect(plan.sparrade.map((k) => k.namn).sort()).toEqual([vecka(40), vecka(33)].sort());
    // Raderingskopior ar ingen sakerhetskopia av produktionen och sparras aldrig.
    expect(plan.raderas.map((k) => k.namn)).toEqual([radering(35)]);
  });
});

describe("rensaSakerhetskopior", () => {
  let rot: string;
  let utskrift: string[];
  const skriv = (rad = "") => utskrift.push(rad);

  beforeEach(async () => {
    rot = await mkdtemp(path.join(tmpdir(), "rensning-"));
    utskrift = [];
    for (const n of [vecka(3), vecka(31), radering(32), radering(4)]) {
      await mkdir(path.join(rot, n, "bilagor"), { recursive: true });
      await writeFile(path.join(rot, n, "bilagor", "kvitto.jpg"), "x".repeat(1000));
    }
    await writeFile(path.join(rot, "anteckningar.txt"), "logg");
  });

  afterEach(async () => {
    await rm(rot, { recursive: true, force: true });
  });

  it("torrkorningen listar antal och storlek men raderar ingenting", async () => {
    const fore = (await readdir(rot)).sort();
    const resultat = await rensaSakerhetskopior(rot, { radera: false, nu: NU, skriv });
    expect((await readdir(rot)).sort()).toEqual(fore);
    expect(resultat.raderade).toBe(0);
    const text = utskrift.join("\n");
    expect(text).toContain(vecka(31));
    expect(text).toContain(radering(32));
    expect(text).toMatch(/2 kopior.*2\.0 kB/);
    expect(text).toMatch(/Torrkörning/);
  });

  it("med radera tas bara de gamla bort – andra filer och de farska ligger kvar", async () => {
    const resultat = await rensaSakerhetskopior(rot, { radera: true, nu: NU, skriv });
    expect(resultat.raderade).toBe(2);
    expect((await readdir(rot)).sort()).toEqual([vecka(3), radering(4), "anteckningar.txt"].sort());
  });

  it("foljer aldrig en symbolisk lank ut ur katalogen", async () => {
    const utanfor = await mkdtemp(path.join(tmpdir(), "utanfor-"));
    await writeFile(path.join(utanfor, "viktig.txt"), "ror inte");
    await symlink(utanfor, path.join(rot, vecka(60)));
    await rensaSakerhetskopior(rot, { radera: true, nu: NU, skriv });
    expect(await readdir(utanfor)).toEqual(["viktig.txt"]);
    await rm(utanfor, { recursive: true, force: true });
  });
});

describe("sakerhetskopiekatalog", () => {
  it("ar densamma for kopieringen, rensningen och raderingen – standard under hemkatalogen", async () => {
    const { sakerhetskopiekatalog } = await import("@/lib/sakerhetskopior/katalog");
    const { homedir } = await import("node:os");
    expect(sakerhetskopiekatalog("/repo", {})).toBe(path.join(homedir(), "Säkerhetskopior", "bostadsunderlag"));
    expect(sakerhetskopiekatalog("/repo", { SAKERHETSKOPIA_KATALOG: "/kopior" })).toBe("/kopior");
  });

  it("vagrar en katalog inuti repot", async () => {
    const { sakerhetskopiekatalog } = await import("@/lib/sakerhetskopior/katalog");
    expect(() => sakerhetskopiekatalog("/repo", { SAKERHETSKOPIA_KATALOG: "/repo/kopior" })).toThrow(/repot/);
  });
});
