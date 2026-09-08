import { describe, expect, it } from "vitest";
import { fraga3Relevant, tolkaProjektfragor } from "@/doman/projektfragor";

describe("fraga 3 dyker upp nar svaret pa fraga 2 ar 'Det fanns redan'", () => {
  it("fanns forut => fraga 3 (skick vid tilltradet) visas", () => {
    expect(fraga3Relevant("fanns")).toBe(true);
  });

  it("nytt => fraga 3 doljs, skicket saknar betydelse for en grundforbattring", () => {
    expect(fraga3Relevant("nytt")).toBe(false);
  });

  it("fraga 2 obesvarad => fraga 3 visas inte an", () => {
    expect(fraga3Relevant("")).toBe(false);
  });
});

describe("projektfragorna: fraga 3 stalls bara nar det fanns forut", () => {
  it("nytt ger grundforbattring och slitet_vid_tilltrade = null", () => {
    expect(tolkaProjektfragor("nytt", "")).toEqual({
      kategori: "grundforbattring",
      slitet_vid_tilltrade: null,
    });
  });

  it("nytt ignorerar ett medskickat slitet-svar och lamnar slitet null", () => {
    expect(tolkaProjektfragor("nytt", "ja").slitet_vid_tilltrade).toBe(null);
  });

  it("fanns + slitet 'ja' ger reparation och slitet_vid_tilltrade = true", () => {
    expect(tolkaProjektfragor("fanns", "ja")).toEqual({
      kategori: "reparation",
      slitet_vid_tilltrade: true,
    });
  });

  it("fanns + slitet 'nej' ger reparation och slitet_vid_tilltrade = false", () => {
    expect(tolkaProjektfragor("fanns", "nej")).toEqual({
      kategori: "reparation",
      slitet_vid_tilltrade: false,
    });
  });

  it("fanns + 'vet-inte' ger reparation med slitet_vid_tilltrade = null", () => {
    expect(tolkaProjektfragor("fanns", "vet-inte")).toEqual({
      kategori: "reparation",
      slitet_vid_tilltrade: null,
    });
  });
});
