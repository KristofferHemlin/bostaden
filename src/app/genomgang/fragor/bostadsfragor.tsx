"use client";

// Bostadsfragorna (produktspec 4.1, 4.6) – forsta agaren, och for en
// bostadsratt med ja aven ombildningen (src/doman/bostadsfragor.ts). Stalls
// EN gang per bostad, som ett steg fore den forsta hogen i genomgangen – inte
// i registreringen, och aldrig per atgard. Blockerar genomgangen tills de ar
// besvarade (bade <GenomgangSida> och <FragorSida> renderar bara den har
// komponenten sa lange bostadsfragornaBesvarade ar falskt, oavsett vilken av
// sidorna som utloste grinden – se `nasta` nedan), eftersom reparationsdelen
// annars inte gar att rakna. Gar att andra i installningarna efterat.
//
// Aterananvander <Fraga> och <Kortval> fran fragetradet.tsx – samma monster
// (rubrik, utfalld hjalpruta, klickbara kort utan underrubriker) som
// atgardens fragor, eftersom bostadsfragorna vager lika tungt.
//
// Inget forval (samma princip som skickskalan, docs/design.md): ett
// obesvarat "Var du forsta agaren?" far aldrig visas som forifyllt "Nej".
// Ett svar som redan givits visas daremot som valt (`givna`).
//
// `nasta` (produktspec 4.1, "Efter frågorna hamnar man i grupperingen"):
// vart sparaBostadsfragor skickar anvandaren efter svaret. Standard ar
// grupperingen – den som just svarat forsta gangen har per definition inget
// grupperat, och fas 2 skulle bara mota hen med "Inget mer att klassificera".
// Undantaget ar ingangen fran ett enskilt projekts "Klassificera hogen", dar
// nagot faktiskt finns att klassificera – den ingangen skickar hit
// "/genomgang/fragor" i stallet, sa flodet fortsatter dit den redan var pa
// vag.

import { sparaBostadsfragor } from "./actions";
import type { Bostadsfragesvar } from "@/doman/bostadsfragor";
import { BostadsfragorFormular } from "@/components/bostadsfragor-formular";

export function Bostadsfragor({
  nasta = "/genomgang",
  givna,
}: {
  nasta?: "/genomgang" | "/genomgang/fragor";
  givna: Bostadsfragesvar;
}) {
  return <BostadsfragorFormular action={sparaBostadsfragor} nasta={nasta} givna={givna} />;
}
