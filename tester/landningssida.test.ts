import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { arOskyddadSokvag } from "@/lib/oskyddade-sokvagar";
import { Landningssida } from "@/app/landningssida";

describe("oskyddade sokvagar", () => {
  it("slapper igenom / utan session", () => {
    expect(arOskyddadSokvag("/")).toBe(true);
  });

  it("slapper inte igenom appens sidor bara for att / ar oskyddad", () => {
    for (const s of ["/kostnad", "/kostnad/nytt", "/projekt", "/export", "/installningar"]) {
      expect(arOskyddadSokvag(s)).toBe(false);
    }
  });

  it("inloggning och registrering ar fortsatt oskyddade", () => {
    expect(arOskyddadSokvag("/login")).toBe(true);
    expect(arOskyddadSokvag("/registrera")).toBe(true);
    expect(arOskyddadSokvag("/auth/callback")).toBe(true);
  });

  it("losenordsaterstallningen ar oskyddad – den som glomt losenordet har ingen session", () => {
    expect(arOskyddadSokvag("/losenord/glomt")).toBe(true);
    expect(arOskyddadSokvag("/losenord/nytt")).toBe(true);
  });
});

describe("landningssidan", () => {
  const html = renderToStaticMarkup(Landningssida());

  it("Skapa konto leder till registreringen, Logga in till inloggningen", () => {
    expect(html).toMatch(/<a[^>]*href="\/registrera"[^>]*>Skapa konto<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/login"[^>]*>Logga in<\/a>/);
  });

  it("Skapa konto ar den enda orange knappen", () => {
    expect(html.match(/bg-accent(?![-\w])/g)).toHaveLength(1);
    expect(html).toMatch(/<a[^>]*bg-accent[^>]*>Skapa konto<\/a>/);
    expect(html).toMatch(/<a[^>]*bg-sand[^>]*>Logga in<\/a>/);
  });

  it("namner inget blankettnamn och inget pris", () => {
    expect(html).not.toMatch(/K5|K6|SKV\s*2197/);
    expect(html).not.toMatch(/(?<!\p{L})kr(?!\p{L})|kronor|pris|gratis|prenumeration/iu);
  });

  it("lovar inte att avdraget kraver kvitto (design.md, Landningssidan)", () => {
    const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    expect(text).toContain(
      "Men avdraget vilar på att du kan göra utgiften trolig, och försäljningen kan ligga tjugo år bort. Ett kvitto är det enklaste beviset som finns – och det är därför de flesta betalar för mycket i vinstskatt: kvittona är borta.",
    );
    expect(text).not.toMatch(/kräver att du kan visa/);
  });

  it("har ingen bild, ingen topprad och ingen flikrad", () => {
    expect(html).not.toMatch(/<img|<svg|<nav/);
  });
});
