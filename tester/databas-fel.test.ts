// src/lib/databas-fel.ts – kanner igen anslutningsfelet fran en sovande
// Supabase-databas (produktspec avsnitt 13, punkt 3) sa att gransnittet kan
// visa "databasen vaknar" i stallet for en generisk kraschsida, utan att
// tramsa pa vanliga fel som ska rapporteras som vanligt.

import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { arDatabasSovande } from "@/lib/databas-fel";

describe("arDatabasSovande", () => {
  it("kanner igen P1001 (kan inte na servern) fran en initieringsfel", () => {
    const fel = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `aws-0-eu-north-1.pooler.supabase.com`:`6543`",
      "6.3.0",
      "P1001",
    );
    expect(arDatabasSovande(fel)).toBe(true);
  });

  it("kanner igen P1017 (servern stangde anslutningen) fran ett kant Prisma-fel", () => {
    const fel = new Prisma.PrismaClientKnownRequestError("Server has closed the connection", {
      code: "P1017",
      clientVersion: "6.3.0",
    });
    expect(arDatabasSovande(fel)).toBe(true);
  });

  it("kanner igen ett rått natverksfel som lackt igenom oinslaget", () => {
    expect(arDatabasSovande(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe(true);
  });

  it("kanner INTE igen ett vanligt valideringsfel som en sovande databas", () => {
    const fel = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.3.0",
    });
    expect(arDatabasSovande(fel)).toBe(false);
  });

  it("kanner INTE igen ett godtyckligt fel som en sovande databas", () => {
    expect(arDatabasSovande(new Error("kvittot saknar leverantör"))).toBe(false);
    expect(arDatabasSovande("nagot helt annat")).toBe(false);
    expect(arDatabasSovande(null)).toBe(false);
  });
});
