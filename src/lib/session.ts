// Serverhjalpare kring inloggad anvandare och hens bostad. Kopplingen
// anvandare–bostad gar via medlemskap (aldrig direkt), agarandelen ligger dar.

import "server-only";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { skapaServerklient, supabaseKonfigurerad } from "@/lib/supabase/server";

export interface InloggadAnvandare {
  id: string;
  epost: string;
}

/**
 * Hamtar inloggad Supabase-anvandare och sakerstaller en spegelrad i tabellen
 * `anvandare` (id = auth-uid). Returnerar null om ingen session finns.
 */
export async function hamtaAnvandare(): Promise<InloggadAnvandare | null> {
  // Utan riktiga NEXT_PUBLIC_SUPABASE_*-varden finns ingen inloggning att fraga.
  // Behandla som "ingen session" – da bouncar allt till /login (som renderar och
  // forklarar vid forsok att logga in).
  if (!supabaseKonfigurerad()) return null;

  const supabase = await skapaServerklient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const epost = user.email ?? `${user.id}@utan-epost.local`;
  await sakerstallAnvandarrad(user.id, epost);
  return { id: user.id, epost };
}

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
async function sakerstallAnvandarrad(id: string, epost: string): Promise<void> {
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

  const medlemskap = await prisma.medlemskap.findFirst({
    where: { anvandare_id: anvandare.id },
    orderBy: { skapad_at: "asc" },
  });
  if (!medlemskap) return null;

  return {
    anvandareId: anvandare.id,
    bostadId: medlemskap.bostad_id,
    agarandel: Number(medlemskap.agarandel),
  };
}

/**
 * Krav for alla skarmar som forutsatter en bostad (projekt, kostnad, oversikt).
 * Skickar till /login utan session och till /onboarding utan bostad.
 */
export async function kravBostad(): Promise<AktivBostad> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) redirect("/login");

  const bostad = await hamtaAktivBostad();
  if (!bostad) redirect("/onboarding");
  return bostad;
}
