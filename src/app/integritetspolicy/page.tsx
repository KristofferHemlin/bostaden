// Integritetspolicyn som egen sida (produktspec avsnitt 14, "Integritetspolicyn").
// Nas UTAN inloggning – lagd till i OSKYDDADE_PREFIX i
// src/lib/supabase/middleware.ts – sa att den gar att lasa innan kontot skapas.
// Darfor byggs sidan INTE med <Skarm>: den komponenten antar en inloggad
// bostad (bostadsnamn, huvudmeny, kugghjul mot /installningar) som en
// anonym besokare varken har eller behover har.
//
// Texten ligger i src/innehall/integritetspolicy.md och renderas som den
// star – appen andrar den aldrig. Ändringar gors i filen av den som ansvarar
// for policyn.

import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { EnkelMarkdown } from "@/lib/enkel-markdown";

export const metadata = {
  title: "Integritetspolicy – Bostadsunderlag",
};

export default async function IntegritetspolicySida() {
  const filsokvag = path.join(
    process.cwd(),
    "src/innehall/integritetspolicy.md",
  );
  const text = await readFile(filsokvag, "utf-8");

  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <div className="w-full border-b border-linje bg-yta-upphojd">
        <div className="mx-auto flex w-full max-w-[620px] items-center gap-2.5 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/kajin-hem-logo.png"
              alt=""
              aria-hidden
              className="h-6 w-auto shrink-0 sm:h-7"
            />
            <span className="font-rubrik text-base text-text-primar sm:text-lg">
              Bostadsunderlag
            </span>
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[620px] px-4 py-6 sm:py-10">
        <div className="overflow-hidden rounded-xl bg-yta-upphojd p-5 sm:p-8">
          <EnkelMarkdown text={text} />
        </div>
      </main>
    </div>
  );
}
