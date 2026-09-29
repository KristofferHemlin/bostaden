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

  it("har ingen bild, ingen topprad och ingen flikrad", () => {
    expect(html).not.toMatch(/<img|<svg|<nav/);
  });
});
