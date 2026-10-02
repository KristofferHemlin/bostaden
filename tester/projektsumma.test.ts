import { describe, expect, it } from "vitest";
import { beloppForKostnad, projektSumma, rotForBelopp } from "@/doman/berakningar";
import { kostnad } from "./_hjalp";

// docs/design.md, Listrader och fynd 2026-10-02: projektsummor raknar allt,
// som "Totalt inlagt". Ett projekt ar inte ett kalenderar och har ingen
// anledning att utesluta ett kvitto utan betaldatum – raderna under visar det.

const NORDSTROM = kostnad({
  id: "nordstrom",
  betaldatum: "2026-09-08",
  totalbelopp: 6_081_250,
  rot_utnyttjat: 1_158_750,
});
const OBETALD = kostnad({ id: "obetald", betaldatum: null, totalbelopp: 250_000 });

describe("projektSumma", () => {
  it("ar efter ROT – El fix 49 225 kr", () => {
    expect(projektSumma([NORDSTROM], "p1")).toBe(4_922_500);
  });

  it("raknar kvitton utan betaldatum", () => {
    expect(projektSumma([NORDSTROM, OBETALD], "p1")).toBe(5_172_500);
  });

  it("raknar inte arkiverade kvitton eller andra projekts", () => {
    const arkiverad = kostnad({ id: "a", arkiverad: true });
    const annat = kostnad({ id: "b", projekt_id: "p2" });
    expect(projektSumma([NORDSTROM, arkiverad, annat], "p1")).toBe(4_922_500);
  });

  it("gar att rakna ihop av raderna under: belopp minus visad ROT", () => {
    const kostnader = [NORDSTROM, OBETALD];
    const ihop = kostnader.reduce((s, k) => {
      const belopp = beloppForKostnad(k, "p1");
      return s + belopp - rotForBelopp(k, belopp);
    }, 0);
    expect(projektSumma(kostnader, "p1")).toBe(ihop);
  });
});
