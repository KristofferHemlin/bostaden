import { describe, expect, it } from "vitest";
import { individuelltBelopp } from "@/doman/berakningar";
import {
  avrundaReparationUppat,
  delaIKategorier,
  tillampaSkickfaktor,
  tillampaTidsgranser,
  troskelprovaArspostar,
} from "@/doman/atgardsberakning";
import { kostnad, REGELPARAMETRAR } from "./_hjalp";

const TROSKEL = 500_000; // 5 000 kr i oren

describe("troskeln provas fore skickbedomningen, pa summan av bada kategorierna", () => {
  it("4 659 kr och 1 200 kr samma ar, bada inom fonstret: troskeln passeras pa 5 859 kr trots att skickfaktorn drar ner avdragen till 3 517 kr", () => {
    const opts = {
      forsaljningsAr: 2030,
      femarsfonsterAr: 5,
      upplatelseform: "fastighet" as const,
      bostadenNybyggdVidForvarv: false,
      regelparametrar: REGELPARAMETRAR,
    };
    const k1 = kostnad({ id: "k1", totalbelopp: 465_900, betaldatum: "2030-03-01" });
    const k2 = kostnad({ id: "k2", totalbelopp: 120_000, betaldatum: "2030-03-01" });

    const u1 = tillampaTidsgranser(
      delaIKategorier(k1, { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: 400 }),
      { ...opts, betaldatum: "2030-03-01" },
    );
    const u2 = tillampaTidsgranser(
      delaIKategorier(k2, { atgardstyp: "utbytt", battre_kvalitet: false, merkostnad: null }),
      { ...opts, betaldatum: "2030-03-01" },
    );

    // Summan fore skickbedomningen ar 5 859 kr och passerar troskeln.
    const summaForeSkick =
      u1.grundforbattringsdel + u1.reparationsunderlag + u2.grundforbattringsdel + u2.reparationsunderlag;
    expect(summaForeSkick).toBe(585_900);

    const [t1, t2] = troskelprovaArspostar([u1, u2], TROSKEL);
    expect(t1).toEqual(u1); // troskeln nas, posterna lamnas ororda
    expect(t2).toEqual(u2);

    const avdrag1 = tillampaSkickfaktor(t1, 1, 4);
    const avdrag2 = tillampaSkickfaktor(t2, 1, 4);
    const totalGrundforbattring = avdrag1.grundforbattring + avdrag2.grundforbattring;
    const totalReparation = avrundaReparationUppat(avdrag1.reparation + avdrag2.reparation);

    // Skickfaktorn (0,6) drar ner det sammanlagda avdraget till 3 517 kr, trots
    // att aret redan passerat troskeln pa det oreducerade beloppet.
    expect(totalGrundforbattring + totalReparation).toBe(351_700);
  });

  it("3 000 kr grundforbattring och 3 000 kr reparation, bada ar 2019 vid forsaljning 2026: reparationen bidrar bara med sin grundforbattringsdel till troskelsumman, som blir 3 001 kr, och bada faller bort", () => {
    const opts = {
      forsaljningsAr: 2026,
      femarsfonsterAr: 5,
      upplatelseform: "fastighet" as const,
      bostadenNybyggdVidForvarv: false,
      regelparametrar: REGELPARAMETRAR,
    };
    const kA = kostnad({ id: "kA", totalbelopp: 300_000, betaldatum: "2019-05-01" });
    const kB = kostnad({ id: "kB", totalbelopp: 300_000, betaldatum: "2019-05-01" });

    const uA = tillampaTidsgranser(
      delaIKategorier(kA, { atgardstyp: "nybyggnad", battre_kvalitet: null, merkostnad: null }),
      { ...opts, betaldatum: "2019-05-01" },
    );
    // "Reparation" med en obetydlig merkostnad: 2019 ligger utanfor femarsfonstret
    // (2021-2026) sa reparationsunderlaget nollas, men grundforbattringsdelen –
    // 1 kr av merkostnaden – har inget sadant fonster och overlever.
    const uB = tillampaTidsgranser(
      delaIKategorier(kB, { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: 100 }),
      { ...opts, betaldatum: "2019-05-01" },
    );

    expect(uA).toEqual({ grundforbattringsdel: 300_000, reparationsunderlag: 0 });
    expect(uB).toEqual({ grundforbattringsdel: 100, reparationsunderlag: 0 });

    const summa = uA.grundforbattringsdel + uA.reparationsunderlag + uB.grundforbattringsdel + uB.reparationsunderlag;
    expect(summa).toBe(300_100); // 3 001 kr, under troskeln

    const [tA, tB] = troskelprovaArspostar([uA, uB], TROSKEL);
    expect(tA).toEqual({ grundforbattringsdel: 0, reparationsunderlag: 0 });
    expect(tB).toEqual({ grundforbattringsdel: 0, reparationsunderlag: 0 });
  });

  it("troskeln raknas per bostad, inte per delagare: tva delagare med halften var och 8 000 kr under ett ar passerar gransen", () => {
    const k = kostnad({ totalbelopp: 800_000, betaldatum: "2026-04-01" });
    const uppdelning = tillampaTidsgranser(
      delaIKategorier(k, { atgardstyp: "nybyggnad", battre_kvalitet: null, merkostnad: null }),
      {
        betaldatum: "2026-04-01",
        forsaljningsAr: 2026,
        femarsfonsterAr: 5,
        upplatelseform: "fastighet",
        bostadenNybyggdVidForvarv: false,
        regelparametrar: REGELPARAMETRAR,
      },
    );
    const [efterTroskel] = troskelprovaArspostar([uppdelning], TROSKEL);
    expect(efterTroskel).toEqual(uppdelning); // 8 000 kr >= 5 000 kr, ingen delas ar over 5 000 kr var for sig

    const helaBostaden = efterTroskel.grundforbattringsdel + efterTroskel.reparationsunderlag;
    expect(individuelltBelopp(helaBostaden, 50)).toBe(400_000); // 4 000 kr per delagare
  });
});
