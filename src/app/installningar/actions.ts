"use server";

// Installningssidan. Har bor de bostadsuppgifter som inte behovs for att komma
// igang men som ar bra att fylla i nar man vet dem: storlek (boarea i kvm) och
// kopeskilling (docs/design.md, Registreringsflodet – flyttade hit fran
// registreringen). Tomt falt nollstaller vardet.

import { revalidatePath } from "next/cache";
import { oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface InstallningarResultat {
  fel?: string;
  meddelande?: string;
}

export async function sparaInstallningar(
  _foreg: InstallningarResultat,
  formData: FormData,
): Promise<InstallningarResultat> {
  const { bostadId } = await kravBostad();

  const storlekText = String(formData.get("storlek") ?? "").trim();
  const kopeskillingText = String(formData.get("kopeskilling") ?? "").trim();

  let storlek: number | null = null;
  if (storlekText !== "") {
    const siffror = storlekText.replace(/\D/g, "");
    storlek = siffror ? Number.parseInt(siffror, 10) : 0;
    if (storlek <= 0) {
      return { fel: "Storlek anges i kvadratmeter, t.ex. 72." };
    }
  }

  let kopeskilling: number | null = null;
  if (kopeskillingText !== "") {
    kopeskilling = oreFranKronor(kopeskillingText);
    if (kopeskilling === null || kopeskilling <= 0) {
      return { fel: "Köpeskilling anges som ett belopp, t.ex. 3 250 000." };
    }
  }

  await prisma.bostad.update({
    where: { id: bostadId },
    data: { storlek, kopeskilling },
  });

  revalidatePath("/installningar");
  revalidatePath("/");
  return { meddelande: "Sparat." };
}
