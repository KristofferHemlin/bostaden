import { describe, expect, it } from "vitest";
import { arGiltigtId } from "@/lib/giltigt-id";

// docs/design.md, "Sidan finns inte": ett projekt eller kvitto med ett id som
// inte finns ska saga att det inte finns, inte att nagot gick fel. Ett id som
// inte ens ar en uuid far aldrig na databasen, dar det blir ett fel.

describe("arGiltigtId", () => {
  it("godtar en uuid", () => {
    expect(arGiltigtId("88196471-327e-484e-9164-ce59d726ec51")).toBe(true);
  });

  it("avvisar det en gammal eller felskriven lank kan innehalla", () => {
    for (const id of ["felaktigt-id", "123", "", "88196471-327e-484e-9164-ce59d726ec5", "88196471-327e-484e-9164-ce59d726ec51x"]) {
      expect(arGiltigtId(id)).toBe(false);
    }
  });
});
