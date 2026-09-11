import { describe, expect, it } from "vitest";
import { sorteraPaDatumFallande } from "@/lib/sortering";

// docs/design.md, Kvittolistan: "En arsrubrik lovar tidsordning, och en lista
// som under rubriken 2026 visar april, april, mars, augusti ser ut som en bugg
// aven nar den inte ar det." – exakt det fallet som utlOste den har radningen.

describe("sorteraPaDatumFallande", () => {
  it("sorterar pa datum, nyast forst – inte pa ursprunglig ordning", () => {
    const rader = [
      { id: "april-1", datum: "2026-04-05" },
      { id: "april-2", datum: "2026-04-20" },
      { id: "mars", datum: "2026-03-01" },
      { id: "augusti", datum: "2026-08-15" },
    ];

    const sorterat = sorteraPaDatumFallande(rader, (r) => r.datum);

    expect(sorterat.map((r) => r.id)).toEqual([
      "augusti",
      "april-2",
      "april-1",
      "mars",
    ]);
  });

  it("rader utan datum hamnar sist, i ursprunglig inbordes ordning", () => {
    const rader = [
      { id: "utan-1", datum: null },
      { id: "med", datum: "2026-01-01" },
      { id: "utan-2", datum: null },
    ];

    const sorterat = sorteraPaDatumFallande(rader, (r) => r.datum);

    expect(sorterat.map((r) => r.id)).toEqual(["med", "utan-1", "utan-2"]);
  });

  it("samma datum behaller ursprunglig inbordes ordning (stabil sortering)", () => {
    const rader = [
      { id: "forst", datum: "2026-05-01" },
      { id: "sedan", datum: "2026-05-01" },
    ];

    const sorterat = sorteraPaDatumFallande(rader, (r) => r.datum);

    expect(sorterat.map((r) => r.id)).toEqual(["forst", "sedan"]);
  });

  it("muterar inte den ursprungliga arrayen", () => {
    const rader = [
      { id: "b", datum: "2026-01-01" },
      { id: "a", datum: "2026-06-01" },
    ];
    const kopia = [...rader];

    sorteraPaDatumFallande(rader, (r) => r.datum);

    expect(rader).toEqual(kopia);
  });
});
