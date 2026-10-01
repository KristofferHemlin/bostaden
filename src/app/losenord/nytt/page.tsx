// Sidan lanken i aterstallningsmejlet leder till (via /auth/callback, som
// loser in lanken mot en session). Den gor bara en sak: satter ett nytt
// losenord. Gick lanken inte att losa in (?lank=ogiltig) eller finns ingen
// session visas beskedet om lanken i stallet for formularet.

import { skapaServerklient, supabaseKonfigurerad } from "@/lib/supabase/server";
import { AterstallningsRam } from "../ram";
import { NyttLosenordFormular } from "./formular";
import { OgiltigLank } from "./ogiltig-lank";

export const dynamic = "force-dynamic";

export default async function NyttLosenordSida({
  searchParams,
}: {
  searchParams: Promise<{ lank?: string }>;
}) {
  const { lank } = await searchParams;
  let harSession = false;
  if (lank !== "ogiltig" && supabaseKonfigurerad()) {
    const supabase = await skapaServerklient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    harSession = Boolean(user);
  }

  return (
    <AterstallningsRam rubrik="Nytt lösenord">
      {harSession ? <NyttLosenordFormular /> : <OgiltigLank />}
    </AterstallningsRam>
  );
}
