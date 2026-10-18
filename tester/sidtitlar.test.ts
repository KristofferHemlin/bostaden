import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { metadata as rotMetadata } from "@/app/layout";
import SidanFinnsInte, { metadata as fyraNollFyra } from "@/app/not-found";
import { metadata as policy } from "@/app/integritetspolicy/page";

// En sida utan rubrik har ingen titel att meddela nar en skarmlasare byter
// sida, och flikar med samma titel gar inte att skilja at. Varje sida har
// darfor en h1 och en egen titel, "<Sidans namn> – Kvittobo".

describe("sidtitlar", () => {
  it("rotlayouten sätter mallen '<Sidans namn> – Kvittobo'", () => {
    expect(rotMetadata.title).toEqual({
      default: "Kvittobo",
      template: "%s – Kvittobo",
    });
  });

  it("sidorna anger bara sitt namn – mallen lägger till resten", () => {
    expect(policy.title).toBe("Integritetspolicy");
    expect(fyraNollFyra.title).toBe("Sidan finns inte");
  });
});

describe("404-sidan har en rubrik", () => {
  const html = renderToStaticMarkup(SidanFinnsInte());

  it("meningens första led är sidans enda h1", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<h1 class="inline">Sidan finns inte\.<\/h1>/);
  });

  it("ingen dold rubrik som säger samma sak en gång till", () => {
    expect(html).not.toContain("sr-only");
    expect(html.match(/Sidan finns inte/g)).toHaveLength(1);
  });

  it("hela meningen står kvar, på samma rad som rubriken", () => {
    expect(html.replace(/<[^>]+>/g, "")).toContain(
      "Sidan finns inte. Ingenting du gjort har försvunnit – länken är kanske gammal eller felskriven.",
    );
  });
});
