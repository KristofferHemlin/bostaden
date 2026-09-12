// Serverhjalpare kring inloggad anvandare och hens bostad. Kopplingen
// anvandare–bostad gar via medlemskap (aldrig direkt), agarandelen ligger dar.

import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import { kastaVanligtDatabasfel } from "@/lib/databas-fel";
import { prisma } from "@/lib/prisma";
import { skapaServerklient, supabaseKonfigurerad } from "@/lib/supabase/server";

export interface InloggadAnvandare {
  id: string;
  epost: string;
}

/**
 * Hamtar inloggad Supabase-anvandare och sakerstaller en spegelrad i tabellen
 * `anvandare` (id = auth-uid). Returnerar null om ingen session finns.
 *
 * Cachad per begaran (React cache()) – funktionen kors fran nastan varje
 * sida, och utan detta skulle bade Supabase-anropet och skrivningen i
 * sakerstallAnvandarrad ske en gang per anrop i stallet for en gang per
 * begaran, nu nar aven rot-layouten kallar den (for Sentry.setUser nedan).
 */
export const hamtaAnvandare = cache(async (): Promise<InloggadAnvandare | null> => {
  // Utan riktiga NEXT_PUBLIC_SUPABASE_*-varden finns ingen inloggning att fraga.
  // Behandla som "ingen session" – da bouncar allt till /login (som renderar och
  // forklarar vid forsok att logga in).
  if (!supabaseKonfigurerad()) return null;

  const supabase = await skapaServerklient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Sattas har, tidigt i begaran, sa att den automatiska felfangsten (Next
  // egen krok i instrumentation.ts, error.tsx) far ett anvandar-id aven pa fel
  // ingen kod uttryckligen rapporterar. Bara id:t – aldrig e-post eller namn
  // (produktspec avsnitt 13). beforeSend i sentry-filter.ts reducerar dessutom
  // anvandarobjektet till { id } aven om nagon skulle satta mer har.
  Sentry.setUser({ id: user.id });

  const epost = user.email ?? `${user.id}@utan-epost.local`;
  try {
    await sakerstallAnvandarrad(user.id, epost);
  } catch (fel) {
    // Forsta DB-anropet pa nastan varenda sida (produktspec avsnitt 13, punkt
    // 3) – hit hor det om databasen ligger och sover.
    kastaVanligtDatabasfel(fel, { sida: "session", anrop: "hamtaAnvandare", anvandareId: user.id });
  }
  return { id: user.id, epost };
});

/**
 * Speglar auth-anvandaren till tabellen `anvandare` utan att krocka pa den unika
 * epost-kolumnen. `epost` ar unik och `id` ar PK – en rad kan alltsa redan finnas
 * pa endera nyckeln:
 *
 *  1. Rad med samma id  -> uppdatera epost om den andrats.
 *  2. Rad med samma epost men annat id (t.ex. en tidigare spegling eller en
 *     kvarvarande seed-rad) -> flytta raden till auth-id:t. FK:erna har
 *     ON UPDATE CASCADE, sa medlemskap foljer med.
 *  3. Ingen rad          -> skapa. En kapplopning mot en parallell request som
 *     hann fore fangas som P2002 och svaljs – raden finns da anda.
 */
export async function sakerstallAnvandarrad(
  id: string,
  epost: string,
): Promise<void> {
  const viaId = await prisma.anvandare.findUnique({ where: { id } });
  if (viaId) {
    if (viaId.epost !== epost) {
      await prisma.anvandare.update({ where: { id }, data: { epost } });
    }
    return;
  }

  const viaEpost = await prisma.anvandare.findUnique({ where: { epost } });
  if (viaEpost) {
    await prisma.anvandare.update({ where: { id: viaEpost.id }, data: { id } });
    return;
  }

  try {
    await prisma.anvandare.create({ data: { id, epost } });
  } catch (fel) {
    if (
      fel instanceof Prisma.PrismaClientKnownRequestError &&
      fel.code === "P2002"
    ) {
      return; // parallell request hann skapa raden – inget mer att gora
    }
    throw fel;
  }
}

/** Som hamtaAnvandare men skickar till /login nar ingen session finns. */
export async function kravAnvandare(): Promise<InloggadAnvandare> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) redirect("/login");
  return anvandare;
}

export interface AktivBostad {
  anvandareId: string;
  bostadId: string;
  agarandel: number;
}

/** Forsta medlemskapet for anvandaren, eller null (ingen bostad annu). */
export async function hamtaAktivBostad(): Promise<AktivBostad | null> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) return null;

  let medlemskap;
  try {
    medlemskap = await prisma.medlemskap.findFirst({
      where: { anvandare_id: anvandare.id },
      orderBy: { skapad_at: "asc" },
    });
  } catch (fel) {
    kastaVanligtDatabasfel(fel, {
      sida: "session",
      anrop: "hamtaAktivBostad",
      anvandareId: anvandare.id,
    });
  }
  if (!medlemskap) return null;

  return {
    anvandareId: anvandare.id,
    bostadId: medlemskap.bostad_id,
    agarandel: Number(medlemskap.agarandel),
  };
}

/**
 * Krav for alla skarmar som forutsatter en bostad (projekt, kostnad, oversikt).
 * Skickar till /login utan session och till /registrera utan bostad – dit gar
 * bade den som inte har konto och den inloggade (t.ex. via e-postlank) som annu
 * inte lagt upp nagon bostad.
 */
export async function kravBostad(): Promise<AktivBostad> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) redirect("/login");

  const bostad = await hamtaAktivBostad();
  if (!bostad) redirect("/registrera");
  return bostad;
}
