import { describe, expect, it } from "vitest";
import { formateraKronor, formateraKronorMetrikruta } from "@/lib/format";

// docs/design.md, Metrikblock + Typografi: i metrikrutorna, och bara dar, far
// raden brytas fore "kr". Talet halls ihop av harda mellanslag, enheten flyttar
// ner. Overallt annars ar mellanrummet fore "kr" hart.

const HART = " ";

describe("formateraKronorMetrikruta", () => {
  it("bara mellanrummet fore kr ar brytbart", () => {
    const text = formateraKronorMetrikruta(123_456_789);
    expect(text).toBe(`1${HART}234${HART}567,89 kr`);
    expect(text.match(/ /g)).toHaveLength(1);
  });

  it("talet ar detsamma som i formateraKronor", () => {
    for (const oren of [0, 102_095, 500_000, 104_823_050, 123_456_789]) {
      expect(formateraKronorMetrikruta(oren)).toBe(
        formateraKronor(oren).replace(`${HART}kr`, " kr"),
      );
    }
  });

  it("formateraKronor haller fortfarande ihop belopp och enhet", () => {
    expect(formateraKronor(123_456_789)).not.toContain(" ");
    expect(formateraKronor(123_456_789).endsWith(`${HART}kr`)).toBe(true);
  });
});
