import { describe, expect, it } from "vitest";
import {
  MAX_BILAGA_BYTES,
  filandelse,
  kannIgenFormat,
  lagringsnyckel,
  miniatyrnyckel,
  slumpatFilnamn,
  valideraBilaga,
} from "@/lib/lagring/bilaga-regler";

// Reglerna i produktspec avsnitt 12, "Bilagor och lagring":
// tillatna format JPG/PNG/HEIC/PDF, max 10 MB, HEIC kraver JPG-miniatyr, och
// sokvagen byggs av ett slumpat filnamn – anvandarens filnamn far aldrig hamna
// i den.

describe("valideraBilaga", () => {
  it("godtar JPG, PNG, HEIC och PDF", () => {
    for (const mimetyp of [
      "image/jpeg",
      "image/png",
      "image/heic",
      "application/pdf",
    ]) {
      const r = valideraBilaga({ mimetyp, storlek: 1024, filnamn: "kvitto" });
      expect(r.ok).toBe(true);
    }
  });

  it("avvisar ett format som inte stods", () => {
    const r = valideraBilaga({
      mimetyp: "image/gif",
      storlek: 1024,
      filnamn: "bild.gif",
    });
    expect(r).toEqual({ ok: false, fel: expect.stringContaining("stöds inte") });
  });

  it("avvisar en fil over 10 MB", () => {
    const r = valideraBilaga({
      mimetyp: "image/jpeg",
      storlek: MAX_BILAGA_BYTES + 1,
      filnamn: "stor.jpg",
    });
    expect(r).toEqual({ ok: false, fel: expect.stringContaining("10 MB") });
  });

  it("godtar en fil precis pa 10 MB", () => {
    const r = valideraBilaga({
      mimetyp: "image/jpeg",
      storlek: MAX_BILAGA_BYTES,
      filnamn: "grans.jpg",
    });
    expect(r.ok).toBe(true);
  });

  it("avvisar en tom fil", () => {
    const r = valideraBilaga({
      mimetyp: "image/jpeg",
      storlek: 0,
      filnamn: "tom.jpg",
    });
    expect(r.ok).toBe(false);
  });

  it("faller tillbaka pa filandelsen nar telefonen skickar en generisk MIME-typ", () => {
    const r = valideraBilaga({
      mimetyp: "application/octet-stream",
      storlek: 2048,
      filnamn: "IMG_0421.HEIC",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.format.kraverMiniatyr).toBe(true);
  });
});

describe("kannIgenFormat", () => {
  it("markerar HEIC och HEIF som format som kraver en JPG-miniatyr", () => {
    expect(kannIgenFormat("image/heic", "x")?.kraverMiniatyr).toBe(true);
    expect(kannIgenFormat("image/heif", "x")?.kraverMiniatyr).toBe(true);
  });

  it("markerar JPG, PNG och PDF som format utan miniatyrbehov", () => {
    for (const mimetyp of ["image/jpeg", "image/png", "application/pdf"]) {
      expect(kannIgenFormat(mimetyp, "x")?.kraverMiniatyr).toBe(false);
    }
  });

  it("behaller heic-andelsen for originalet men lagrar en visningsbar MIME-typ", () => {
    expect(kannIgenFormat("image/heic", "x")).toMatchObject({ andelse: "heic" });
  });

  it("ger null for ett okant format med icke-generisk MIME-typ", () => {
    expect(kannIgenFormat("image/tiff", "skan.tiff")).toBeNull();
  });
});

describe("lagringsnyckel och slumpatFilnamn", () => {
  it("foljer monstret {bostad}/{kostnad}/{slumpat_filnamn}", () => {
    const namn = slumpatFilnamn("heic");
    expect(lagringsnyckel("bostad-1", "kostnad-9", namn)).toBe(
      `bostad-1/kostnad-9/${namn}`,
    );
    expect(namn).toMatch(/^[0-9a-f-]{36}\.heic$/);
  });

  it("lagger aldrig anvandarens filnamn – inte ens sokvagstecken – i nyckeln", () => {
    const r = valideraBilaga({
      mimetyp: "image/jpeg",
      storlek: 10,
      filnamn: "../../../etc/passwd.jpg",
    });
    expect(r.ok).toBe(true);
    const namn = slumpatFilnamn(r.ok ? r.format.andelse : "jpg");
    expect(namn).not.toContain("/");
    expect(namn).not.toContain("..");
    expect(namn).not.toContain("passwd");
  });

  it("ger unika filnamn", () => {
    const alla = new Set(
      Array.from({ length: 500 }, () => slumpatFilnamn("jpg")),
    );
    expect(alla.size).toBe(500);
  });
});

describe("miniatyrnyckel", () => {
  it("ligger bredvid originalet och slutar pa .jpg", () => {
    expect(miniatyrnyckel("bostad-1/kostnad-9/abc.heic")).toBe(
      "bostad-1/kostnad-9/abc.miniatyr.jpg",
    );
  });

  it("delar prefix – samma bostad och kostnad – med originalet", () => {
    const original = lagringsnyckel("b", "k", slumpatFilnamn("heic"));
    expect(miniatyrnyckel(original).startsWith("b/k/")).toBe(true);
  });
});

describe("filandelse", () => {
  it("plockar sista andelsen i gemener utan skrap", () => {
    expect(filandelse("IMG_1.HEIC")).toBe("heic");
    expect(filandelse("kvitto.final.pdf")).toBe("pdf");
    expect(filandelse("utan-andelse")).toBe("");
  });
});
