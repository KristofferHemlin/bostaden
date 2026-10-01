import { describe, expect, it } from "vitest";
import { formateraAntal } from "@/lib/format";

// docs/design.md, Typografi: svensk formatering genomgaende, for alla tal i
// granssnittet – inte bara belopp. Ett antal har inget "kr" och far darfor
// aldrig brytas alls: tusentalsavgransaren ar ett hart mellanslag.

const tecken = (text: string) => [...text].map((c) => c.codePointAt(0));

describe("formateraAntal", () => {
  it("fyrsiffriga antal far en tusentalsavgransare, och den ar hart mellanslag", () => {
    const text = formateraAntal(1000);
    // Siffrorna ar oforandrade; det enda tillagda tecknet sitter efter tusentalet.
    expect(text.replace(/\D/g, "")).toBe("1000");
    expect(text).toHaveLength(5);
    expect(text.codePointAt(1)).toBe(0x00a0);
  });

  it("innehaller inget brytbart mellanslag och inget kr", () => {
    for (const antal of [1000, 12_345, 1_204_518]) {
      const text = formateraAntal(antal);
      expect(tecken(text)).not.toContain(0x20);
      expect(text).not.toContain("kr");
      expect(text.replace(/ /g, "")).toBe(String(antal));
    }
  });

  it("tresiffriga antal far ingen avgransare", () => {
    expect(formateraAntal(999)).toBe(String(999));
    expect(formateraAntal(0)).toBe(String(0));
  });
});
