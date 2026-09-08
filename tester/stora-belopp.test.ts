import { describe, expect, it } from "vitest";
import {
  formateraBeloppInmatning,
  oreFranKronor,
  orenTillFalt,
} from "@/lib/format";

// Vinstberakningens belopp pa bostaden – forsaljningspris, kopeskilling,
// kopkostnader, kapitaltillskott, uppskov_tidigare – lagras som BigInt.
// Int (Postgres int4) tar slut vid 2 147 483 647 oren, ~21,5 miljoner kronor,
// och sparningen kraschade med "Unable to fit" nar en villaforsaljning lag over
// det. Har provas hela kedjan strang -> oren -> lagring (bigint) -> falt igen
// for belopp langt over den gransen, utan att nagot tappas.

const INT4_MAX_OREN = 2_147_483_647; // ~21 474 836,47 kr

describe("stora belopp: tolkning och gruppering", () => {
  it("30 000 000 kr tolkas till ett orebelopp langt over int4-taket", () => {
    const oren = oreFranKronor("30 000 000");
    expect(oren).toBe(3_000_000_000);
    expect(oren! > INT4_MAX_OREN).toBe(true);
  });

  it("oren over int4-taket ryms exakt i en JS-number (under 2^53)", () => {
    const oren = oreFranKronor("30 000 000,00")!;
    expect(Number.isSafeInteger(oren)).toBe(true);
    expect(oren).toBe(3_000_000_000);
  });

  it("beloppsfaltet grupperar stora heltal medan man skriver", () => {
    expect(formateraBeloppInmatning("30000000")).toBe("30 000 000");
    expect(formateraBeloppInmatning("30000000,5")).toBe("30 000 000,5");
    expect(formateraBeloppInmatning("125000000,00")).toBe(
      "125 000 000,00",
    );
  });

  it("orat i oreFranKronor tappas inte for langa sifferstrangar", () => {
    // 999 999 999,99 kr
    expect(oreFranKronor("999 999 999,99")).toBe(99_999_999_999);
  });
});

describe("orenTillFalt: bigint fran lagringen tillbaka till en falt-strang", () => {
  it("number-vagen ar ofrandrad ((oren/100).toFixed(2))", () => {
    expect(orenTillFalt(34_500)).toBe("345,00");
    expect(orenTillFalt(0)).toBe("0,00");
  });

  it("bigint over int4-taket blir ratt kron- och oredel", () => {
    expect(orenTillFalt(3_000_000_000n)).toBe("30000000,00");
    expect(orenTillFalt(2_147_483_648n)).toBe("21474836,48");
  });

  it("bigint over 2^53 delas utan avrundning – dar Number(oren) skulle tappa siffror", () => {
    const oren = 92_233_720_368_547_758n;
    expect(Number.isSafeInteger(Number(oren))).toBe(false); // Number tappar precision
    expect(orenTillFalt(oren)).toBe("922337203685477,58");
  });
});

describe("stora belopp: full rundtur strang -> oren -> bigint -> falt -> strang", () => {
  it("ett belopp over int4-taket overlever hela kedjan", () => {
    const inmatat = "27 450 000";
    const oren = oreFranKronor(inmatat)!; // number
    expect(oren).toBe(2_745_000_000);

    const lagrat = BigInt(oren); // det som gar till BigInt-kolumnen
    expect(lagrat).toBe(2_745_000_000n);

    const tillbaka = orenTillFalt(lagrat); // prefill nar sidan laddas om
    expect(tillbaka).toBe("27450000,00");

    const grupperat = formateraBeloppInmatning(tillbaka);
    expect(grupperat).toBe("27 450 000,00");

    // Och strangen gar att tolka tillbaka till exakt samma orebelopp.
    expect(oreFranKronor(grupperat)).toBe(oren);
  });
});
