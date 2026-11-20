import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Vad Sentry får från servern. Appens riktiga sentry.server.config.ts
// initieras mot en lokal server som spelar in varje kuvert, och ett Prisma-fel
// rapporteras som appen gör det (src/lib/feltrapportering.ts). Meddelandet är
// ett riktigt valideringsfel, uppmätt mot databasen 2026-11-20 och sparat i
// tester/fixturer/prisma-valideringsfel.json – det bar då en leverantör och
// en gatuadress i klartext.

const ROT = process.cwd();
const PRISMA = JSON.parse(readFileSync(join(ROT, "tester/fixturer/prisma-valideringsfel.json"), "utf-8")).meddelanden as Record<string, string>;
const KANSLIGT = /Hemliga Byggfirman|Storgatan 1|anna\.andersson@exempel\.se|tolvtusen/;

const kuvert: { typer: string[]; delar: Record<string, unknown>[] }[] = [];
let server: Server;
let Sentry: typeof import("@sentry/nextjs");

beforeAll(async () => {
  server = createServer((req, res) => {
    let kropp = "";
    req.on("data", (d) => (kropp += d));
    req.on("end", () => {
      const rader = kropp.split("\n").filter(Boolean).slice(1).map((r) => JSON.parse(r) as Record<string, unknown>);
      kuvert.push({
        typer: rader.filter((r) => typeof r.type === "string").map((r) => r.type as string),
        delar: rader.filter((r) => typeof r.type !== "string"),
      });
      res.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  process.env.NEXT_PUBLIC_SENTRY_DSN = `http://nyckel@127.0.0.1:${(server.address() as { port: number }).port}/1`;
  process.env.SENTRY_RELEASE = "prov-1";
  Sentry = await import("@sentry/nextjs");
  await import("../sentry.server.config");
}, 60_000);

afterAll(async () => {
  await Sentry?.close(2000);
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  await new Promise<void>((r) => server?.close(() => r()));
});

describe("Sentry på servern", () => {
  it("sessionerna är avstängda – och de hade annars varit med", () => {
    // Förutsättningen: standarduppsättningen har processens session.
    expect(Sentry.getDefaultIntegrations({}).map((i) => i.name)).toContain("ProcessSession");
    const aktiva = Sentry.getClient()!.getOptions().integrations.map((i) => i.name);
    expect(aktiva, "förutsättningen: Sentry är initierat med sina standardintegrationer").toContain("RequestData");
    expect(aktiva).not.toContain("ProcessSession");
    expect(Sentry.getClient()!.getOptions().sendClientReports).toBe(false);
  });

  it("ett rapporterat Prisma-fel kommer fram utan anropets argument, och går att läsa", async () => {
    const { rapporteraFel } = await import("@/lib/feltrapportering");
    // Förutsättningen: meddelandet bär värdena.
    expect(PRISMA.kostnadMedFelTyp).toMatch(KANSLIGT);
    // Adressen byggs vid korningen: Sentry skickar sju rader kallkod runt
    // varje ram (ContextLines), och en adress skriven har i koden hade dykt
    // upp dar – som var egen kod, inte som nagot hon matat in.
    console.error(`Inloggningen avvisades: ${["anna.andersson", "exempel.se"].join("@")}`);
    rapporteraFel(new Error(PRISMA.kostnadMedFelTyp), {
      sida: "kostnad/nytt",
      anrop: "sparaKostnad",
      anvandareId: "a0000000-0000-4000-8000-0000000000aa",
    });
    await Sentry.flush(5000);

    const handelser = kuvert.filter((k) => k.typer.includes("event"));
    expect(handelser, "förutsättningen: felet skickades").toHaveLength(1);
    expect(kuvert.flatMap((k) => k.typer).filter((t) => t !== "event")).toEqual([]);
    const h = handelser[0].delar[0] as {
      exception?: { values?: { value?: string }[] };
      tags?: Record<string, string>;
      user?: Record<string, unknown>;
      breadcrumbs?: { category?: string }[];
    };
    const varde = h.exception!.values![0].value!;
    expect(varde).toContain("Invalid `prisma.kostnad.findMany()` invocation:");
    expect(varde).toContain(
      "Argument `totalbelopp`: Invalid value provided. Expected IntNullableFilter, Int or Null, provided String.",
    );
    expect(h.tags).toMatchObject({ sida: "kostnad/nytt", anrop: "sparaKostnad" });
    expect(h.user).toEqual({ id: "a0000000-0000-4000-8000-0000000000aa" });
    expect((h.breadcrumbs ?? []).map((b) => b.category)).not.toContain("console");
    expect(JSON.stringify(h).match(KANSLIGT)).toBeNull();
  }, 30_000);
});
