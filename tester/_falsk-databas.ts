// En Prisma-klient i minnet for atkomsttesterna. Den tolkar `where` pa riktigt
// – skalara villkor, `in`/`not`, relationsfilter med some/every/none – sa att
// ett test fallerar om nagon tar bort ett `bostad_id`-villkor ur en fraga.
// En mock som bara svarar det testet sagt at den skulle inte markt det.
//
// Tacker de delar av Prismas API som appens sidor och serveratgarder
// anvander, inte mer. Nastlade skrivningar (t.ex. `rader: { create }`) stods
// bara for create, och orderBy bara pa skalara falt.

import { randomUUID } from "node:crypto";

type Rad = Record<string, unknown>;
type Modell =
  | "anvandare"
  | "bostad"
  | "medlemskap"
  | "projekt"
  | "kostnad"
  | "kostnadsrad"
  | "radfordelning"
  | "bilaga"
  | "inbjudan"
  | "regelparameter";

interface Relation {
  modell: Modell;
  typ: "en" | "manga";
  lokal: string;
  fjarr: string;
}

const en = (modell: Modell, lokal: string): Relation => ({ modell, typ: "en", lokal, fjarr: "id" });
const manga = (modell: Modell, fjarr: string): Relation => ({ modell, typ: "manga", lokal: "id", fjarr });

// Speglar prisma/schema.prisma.
const RELATIONER: Record<Modell, Record<string, Relation>> = {
  anvandare: {
    aktiv_bostad: en("bostad", "aktiv_bostad_id"),
    medlemskap: manga("medlemskap", "anvandare_id"),
    kostnader_skapade: manga("kostnad", "skapad_av"),
    projekt_klassificerade: manga("projekt", "klassificerad_av"),
    inbjudningar_skickade: manga("inbjudan", "inbjuden_av"),
  },
  bostad: {
    medlemskap: manga("medlemskap", "bostad_id"),
    projekt: manga("projekt", "bostad_id"),
    kostnader: manga("kostnad", "bostad_id"),
    inbjudningar: manga("inbjudan", "bostad_id"),
    aktiv_for: manga("anvandare", "aktiv_bostad_id"),
  },
  medlemskap: { anvandare: en("anvandare", "anvandare_id"), bostad: en("bostad", "bostad_id") },
  projekt: {
    bostad: en("bostad", "bostad_id"),
    klassificerare: en("anvandare", "klassificerad_av"),
    fordelningar: manga("radfordelning", "projekt_id"),
  },
  kostnad: {
    bostad: en("bostad", "bostad_id"),
    skapare: en("anvandare", "skapad_av"),
    rader: manga("kostnadsrad", "kostnad_id"),
    bilagor: manga("bilaga", "kostnad_id"),
  },
  kostnadsrad: { kostnad: en("kostnad", "kostnad_id"), fordelningar: manga("radfordelning", "kostnadsrad_id") },
  radfordelning: { kostnadsrad: en("kostnadsrad", "kostnadsrad_id"), projekt: en("projekt", "projekt_id") },
  bilaga: { kostnad: en("kostnad", "kostnad_id") },
  inbjudan: { bostad: en("bostad", "bostad_id"), inbjudare: en("anvandare", "inbjuden_av") },
  regelparameter: {},
};

// ON DELETE i schemat: vad som hander med barnraderna nar foraldern raderas.
const VID_RADERING: { fran: Modell; till: Modell; falt: string; satt: "cascade" | "null" }[] = [
  { fran: "anvandare", till: "medlemskap", falt: "anvandare_id", satt: "cascade" },
  { fran: "anvandare", till: "kostnad", falt: "skapad_av", satt: "null" },
  { fran: "anvandare", till: "projekt", falt: "klassificerad_av", satt: "null" },
  { fran: "anvandare", till: "inbjudan", falt: "inbjuden_av", satt: "null" },
  { fran: "bostad", till: "anvandare", falt: "aktiv_bostad_id", satt: "null" },
  { fran: "bostad", till: "inbjudan", falt: "bostad_id", satt: "cascade" },
  { fran: "bostad", till: "medlemskap", falt: "bostad_id", satt: "cascade" },
  { fran: "bostad", till: "projekt", falt: "bostad_id", satt: "cascade" },
  { fran: "bostad", till: "kostnad", falt: "bostad_id", satt: "cascade" },
  { fran: "projekt", till: "radfordelning", falt: "projekt_id", satt: "cascade" },
  { fran: "kostnad", till: "kostnadsrad", falt: "kostnad_id", satt: "cascade" },
  { fran: "kostnad", till: "bilaga", falt: "kostnad_id", satt: "cascade" },
  { fran: "kostnadsrad", till: "radfordelning", falt: "kostnadsrad_id", satt: "cascade" },
];

// Standardvarden, sa att en rad skapad av appen har samma falt som i Postgres.
const STANDARD: Record<Modell, () => Rad> = {
  anvandare: () => ({ aktiv_bostad_id: null }),
  bostad: () => ({
    namn: null, adress: null, place_id: null, latitud: null, longitud: null, ort: null,
    storlek: null, identifiering: null, husform: null, nybyggd_vid_forvarv: false,
    ombildning_fran_hyresratt: false, bostadsfragor_besvarade: false, kopeskilling: null,
    kopkostnader: null, kapitaltillskott: null, uppskov_tidigare: null,
    forsaljningsdatum: null, forsaljningspris: null,
  }),
  medlemskap: () => ({ agarandel: 100 }),
  projekt: () => ({
    atgardstyp: null, battre_kvalitet: null, merkostnad: null, skick_forvarv: null,
    skick_forsaljning: null, motivering: null, klassificerad_av: null,
  }),
  kostnad: () => ({
    leverantor: null, totalbelopp: null, dokumentdatum: null, betaldatum: null,
    rot_utnyttjat: null, forsakringsersattning: null, arkiverad: false, anteckning: null,
    skapad_av: null,
  }),
  kostnadsrad: () => ({}),
  radfordelning: () => ({ projekt_id: null, privat: false }),
  bilaga: () => ({
    kostnad_id: null, miniatyrnyckel: null, visningsnyckel: null, uppladdning_bekraftad: false,
    dokument_analyserad: false, sidantal: null, bredd: null, hojd: null,
  }),
  inbjudan: () => ({ inbjuden_av: null, status: "utestaende", besvarad_at: null }),
  regelparameter: () => ({ giltig_till: null, kalla: null }),
};

export type Tabeller = Record<Modell, Rad[]>;

function tommaTabeller(): Tabeller {
  return {
    anvandare: [], bostad: [], medlemskap: [], projekt: [], kostnad: [],
    kostnadsrad: [], radfordelning: [], bilaga: [], inbjudan: [], regelparameter: [],
  };
}

export class InteHittad extends Error {
  code = "P2025";
}

function jamfor(a: unknown): unknown {
  return a instanceof Date ? a.getTime() : a;
}

function lika(a: unknown, b: unknown): boolean {
  return jamfor(a) === jamfor(b);
}

function arVillkorsobjekt(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);
}

function skalarMatchar(varde: unknown, villkor: unknown): boolean {
  if (!arVillkorsobjekt(villkor)) return lika(varde, villkor);
  if (villkor.mode === "insensitive") {
    const gemen = (x: unknown) => (typeof x === "string" ? x.toLowerCase() : x);
    const { mode: _mode, ...rest } = villkor;
    const omskrivet = Object.fromEntries(
      Object.entries(rest).map(([op, arg]) => [op, Array.isArray(arg) ? arg.map(gemen) : gemen(arg)]),
    );
    return skalarMatchar(gemen(varde), omskrivet);
  }
  for (const [op, arg] of Object.entries(villkor)) {
    if (arg === undefined) continue;
    const v = jamfor(varde) as number;
    const x = jamfor(arg) as number;
    switch (op) {
      case "equals": if (!lika(varde, arg)) return false; break;
      case "in": if (!(arg as unknown[]).some((a) => lika(varde, a))) return false; break;
      case "notIn": if ((arg as unknown[]).some((a) => lika(varde, a))) return false; break;
      case "not": if (skalarMatchar(varde, arg)) return false; break;
      case "lt": if (!(varde != null && v < x)) return false; break;
      case "lte": if (!(varde != null && v <= x)) return false; break;
      case "gt": if (!(varde != null && v > x)) return false; break;
      case "gte": if (!(varde != null && v >= x)) return false; break;
      default: throw new Error(`Falsk databas: okand operator ${op}`);
    }
  }
  return true;
}

export function skapaFalskDatabas() {
  let t = tommaTabeller();
  // Ser varje svar databasen ger – for test som provar att en sida inte LASER
  // en annan bostads data, inte bara att den inte skriver i den.
  let lyssnare: ((modell: Modell, svar: unknown) => void) | null = null;

  function relaterade(rel: Relation, rad: Rad): Rad[] {
    const nyckel = rad[rel.lokal];
    if (nyckel == null) return [];
    return t[rel.modell].filter((r) => lika(r[rel.fjarr], nyckel));
  }

  function matchar(modell: Modell, rad: Rad, where: unknown): boolean {
    if (!where) return true;
    for (const [k, v] of Object.entries(where as Rad)) {
      if (v === undefined) continue;
      if (k === "AND") {
        const lista = Array.isArray(v) ? v : [v];
        if (!lista.every((w) => matchar(modell, rad, w))) return false;
        continue;
      }
      if (k === "OR") {
        if (!(v as unknown[]).some((w) => matchar(modell, rad, w))) return false;
        continue;
      }
      if (k === "NOT") {
        const lista = Array.isArray(v) ? v : [v];
        if (lista.some((w) => matchar(modell, rad, w))) return false;
        continue;
      }
      // Sammansatt unik nyckel, t.ex. anvandare_id_bostad_id: { anvandare_id, bostad_id }.
      if (!(k in rad) && !RELATIONER[modell][k] && arVillkorsobjekt(v) && Object.keys(v).join("_") === k) {
        if (!matchar(modell, rad, v)) return false;
        continue;
      }
      const rel = RELATIONER[modell][k];
      if (rel && rel.typ === "en") {
        const [mal] = relaterade(rel, rad);
        if (v === null) {
          if (mal) return false;
          continue;
        }
        const villkor = v as Rad;
        if ("is" in villkor || "isNot" in villkor) {
          if ("is" in villkor) {
            if (villkor.is === null ? !!mal : !mal || !matchar(rel.modell, mal, villkor.is)) return false;
          }
          if ("isNot" in villkor) {
            if (villkor.isNot === null ? !mal : !!mal && matchar(rel.modell, mal, villkor.isNot)) return false;
          }
          continue;
        }
        if (!mal || !matchar(rel.modell, mal, villkor)) return false;
        continue;
      }
      if (rel && rel.typ === "manga") {
        const lista = relaterade(rel, rad);
        const villkor = v as Rad;
        if ("some" in villkor && !lista.some((r) => matchar(rel.modell, r, villkor.some))) return false;
        if ("every" in villkor && !lista.every((r) => matchar(rel.modell, r, villkor.every))) return false;
        if ("none" in villkor && lista.some((r) => matchar(rel.modell, r, villkor.none))) return false;
        continue;
      }
      if (!skalarMatchar(rad[k], v)) return false;
    }
    return true;
  }

  function sortera(rader: Rad[], orderBy: unknown): Rad[] {
    if (!orderBy) return rader;
    const lista = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Rad[];
    const nycklar = lista.flatMap((o) =>
      Object.entries(o).filter(([, riktning]) => typeof riktning === "string") as [string, string][],
    );
    return [...rader].sort((a, b) => {
      for (const [falt, riktning] of nycklar) {
        const x = jamfor(a[falt]) as number;
        const y = jamfor(b[falt]) as number;
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : 1) * (riktning === "desc" ? -1 : 1);
      }
      return 0;
    });
  }

  function projicera(modell: Modell, rad: Rad, args: Rad | undefined): Rad {
    const select = args?.select as Rad | undefined;
    const include = args?.include as Rad | undefined;
    const relationsvarde = (k: string, v: unknown) => {
      const rel = RELATIONER[modell][k];
      const underArgs = v === true ? undefined : (v as Rad);
      if (rel.typ === "en") {
        const [mal] = relaterade(rel, rad);
        return mal ? projicera(rel.modell, mal, underArgs) : null;
      }
      let lista = relaterade(rel, rad).filter((r) => matchar(rel.modell, r, underArgs?.where));
      lista = sortera(lista, underArgs?.orderBy);
      if (typeof underArgs?.take === "number") lista = lista.slice(0, underArgs.take);
      return lista.map((r) => projicera(rel.modell, r, underArgs));
    };
    if (select) {
      const ut: Rad = {};
      for (const [k, v] of Object.entries(select)) {
        if (!v || k === "_count") continue;
        ut[k] = RELATIONER[modell][k] ? relationsvarde(k, v) : rad[k];
      }
      return ut;
    }
    const ut: Rad = { ...rad };
    for (const [k, v] of Object.entries(include ?? {})) {
      if (v && k !== "_count") ut[k] = relationsvarde(k, v);
    }
    return ut;
  }

  function sok(modell: Modell, args: Rad | undefined): Rad[] {
    let rader = t[modell].filter((r) => matchar(modell, r, args?.where));
    rader = sortera(rader, args?.orderBy);
    if (typeof args?.skip === "number") rader = rader.slice(args.skip);
    if (typeof args?.take === "number") rader = rader.slice(0, args.take);
    return rader;
  }

  function skapa(modell: Modell, data: Rad): Rad {
    const rad: Rad = { id: randomUUID(), skapad_at: new Date(), ...STANDARD[modell]() };
    const nastlade: [Relation, Rad][] = [];
    for (const [k, v] of Object.entries(data)) {
      const rel = RELATIONER[modell][k];
      if (rel) {
        if (rel.typ === "manga" && arVillkorsobjekt(v)) nastlade.push([rel, v]);
        continue;
      }
      if (v !== undefined) rad[k] = v;
    }
    t[modell].push(rad);
    for (const [rel, v] of nastlade) {
      const barn = v.create === undefined ? [] : Array.isArray(v.create) ? v.create : [v.create];
      for (const b of barn as Rad[]) skapa(rel.modell, { ...b, [rel.fjarr]: rad[rel.lokal] });
    }
    return rad;
  }

  function tillampa(modell: Modell, rad: Rad, data: Rad) {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const rel = RELATIONER[modell][k];
      if (rel && rel.typ === "manga" && arVillkorsobjekt(v) && Object.keys(v).every((n) => n === "create")) {
        const barn = Array.isArray(v.create) ? v.create : [v.create];
        for (const b of barn as Rad[]) skapa(rel.modell, { ...b, [rel.fjarr]: rad[rel.lokal] });
        continue;
      }
      if (arVillkorsobjekt(v) && "set" in v) rad[k] = v.set;
      else if (arVillkorsobjekt(v) && "increment" in v) rad[k] = (rad[k] as number) + (v.increment as number);
      else if (arVillkorsobjekt(v)) throw new Error(`Falsk databas: nastlad skrivning ${k} stods inte`);
      else rad[k] = v;
    }
  }

  function radera(modell: Modell, rad: Rad) {
    t[modell] = t[modell].filter((r) => r !== rad);
    for (const regel of VID_RADERING.filter((r) => r.fran === modell)) {
      for (const barn of t[regel.till].filter((r) => lika(r[regel.falt], rad.id))) {
        if (regel.satt === "cascade") radera(regel.till, barn);
        else barn[regel.falt] = null;
      }
    }
  }

  function delegat(modell: Modell) {
    const metoder = {
      findUnique: async (a: Rad) => { const [r] = sok(modell, a); return r ? projicera(modell, r, a) : null; },
      findFirst: async (a: Rad = {}) => { const [r] = sok(modell, a); return r ? projicera(modell, r, a) : null; },
      findUniqueOrThrow: async (a: Rad) => { const [r] = sok(modell, a); if (!r) throw new InteHittad(modell); return projicera(modell, r, a); },
      findFirstOrThrow: async (a: Rad = {}) => { const [r] = sok(modell, a); if (!r) throw new InteHittad(modell); return projicera(modell, r, a); },
      findMany: async (a: Rad = {}) => sok(modell, a).map((r) => projicera(modell, r, a)),
      count: async (a: Rad = {}) => sok(modell, a).length,
      create: async (a: Rad) => projicera(modell, skapa(modell, a.data as Rad), a),
      createMany: async (a: Rad) => { const d = a.data as Rad[]; d.forEach((x) => skapa(modell, x)); return { count: d.length }; },
      update: async (a: Rad) => { const [r] = sok(modell, { where: a.where }); if (!r) throw new InteHittad(modell); tillampa(modell, r, a.data as Rad); return projicera(modell, r, a); },
      updateMany: async (a: Rad) => { const rader = sok(modell, { where: a.where }); rader.forEach((r) => tillampa(modell, r, a.data as Rad)); return { count: rader.length }; },
      delete: async (a: Rad) => { const [r] = sok(modell, { where: a.where }); if (!r) throw new InteHittad(modell); const kopia = projicera(modell, r, a); radera(modell, r); return kopia; },
      deleteMany: async (a: Rad = {}) => { const rader = sok(modell, { where: a.where }); rader.forEach((r) => radera(modell, r)); return { count: rader.length }; },
    };
    return Object.fromEntries(
      Object.entries(metoder).map(([namn, fn]) => [
        namn,
        async (a?: Rad) => {
          const svar = await fn(a as Rad);
          lyssnare?.(modell, svar);
          return svar;
        },
      ]),
    ) as typeof metoder;
  }

  const klient = {
    anvandare: delegat("anvandare"),
    bostad: delegat("bostad"),
    medlemskap: delegat("medlemskap"),
    projekt: delegat("projekt"),
    kostnad: delegat("kostnad"),
    kostnadsrad: delegat("kostnadsrad"),
    radfordelning: delegat("radfordelning"),
    bilaga: delegat("bilaga"),
    inbjudan: delegat("inbjudan"),
    regelparameter: delegat("regelparameter"),
    // En interaktiv transaktion ar atomar: kastar den ateraterstalls tabellerna.
    $transaction: async (arg: unknown) => {
      if (typeof arg !== "function") return Promise.all(arg as Promise<unknown>[]);
      const fore = structuredClone(t);
      try {
        return await (arg as (k: unknown) => unknown)(klient);
      } catch (fel) {
        t = fore;
        throw fel;
      }
    },
  };

  return {
    klient,
    /** Tomma tabeller infor nasta test. */
    nollstall() {
      t = tommaTabeller();
      lyssnare = null;
    },
    /** Anropas med varje svar databasen ger, tills nollstall(). */
    lyssna(fn: (modell: Modell, svar: unknown) => void) {
      lyssnare = fn;
    },
    /** Lagger in rader rakt i tabellen, med samma standardvarden som Postgres. */
    lagg(modell: Modell, data: Rad): Rad {
      return skapa(modell, data);
    },
    /** Djup kopia av tabellerna – for att jamfora fore och efter. */
    ogonblick(): Tabeller {
      return structuredClone(t);
    },
    tabell(modell: Modell): Rad[] {
      return t[modell];
    },
  };
}
