import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SidanFinnsInte from "@/app/not-found";

// docs/design.md, "Sidan finns inte, och när något gick fel": appens egen
// 404-sida, pa svenska, som sager att ingenting gatt forlorat och leder till
// oversikten. Uppmatt 2026-10-02 stod ramverkets engelska sida dar.

describe("404-sidan", () => {
  const html = renderToStaticMarkup(SidanFinnsInte());

  it("ar pa svenska och sager att ingenting forsvunnit", () => {
    expect(html).toContain("Sidan finns inte.");
    expect(html).toContain("Ingenting du gjort har försvunnit");
    expect(html).not.toMatch(/could not be found|404/i);
  });

  it("sager inte att nagot gick fel – en sak som inte finns ar inte ett fel", () => {
    expect(html).not.toContain("gick fel");
  });

  it("leder till oversikten", () => {
    expect(html).toMatch(/href="\/"[^>]*>Till översikten</);
  });
});
