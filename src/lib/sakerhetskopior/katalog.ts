// Var sakerhetskopiorna ligger – ett stalle for alla tre skripten
// (sakerhetskopiera, rensa-sakerhetskopior, radera-konto). Rensningen maste
// leta exakt dar kopiorna skrivs; tre egna kopior av samma uttryck kan glida
// isar, och da rensar den en tom katalog medan kopiorna ligger kvar.
//
// Namnet "bostadsunderlag" star kvar fran fore namnbytet till Kvittobo: de
// befintliga kopiorna ligger dar, och ett nytt namn skulle lamna dem utanfor
// rensningen.

import { homedir } from "node:os";
import path from "node:path";

export function sakerhetskopiekatalog(
  repotsRot: string,
  miljo: Record<string, string | undefined> = process.env,
): string {
  const vald = miljo.SAKERHETSKOPIA_KATALOG?.trim();
  const rot = path.resolve(vald || path.join(homedir(), "Säkerhetskopior", "bostadsunderlag"));
  const repo = path.resolve(repotsRot);
  if (rot === repo || rot.startsWith(repo + path.sep)) {
    throw new Error(`Kopian får inte ligga i repot (${rot}). Den innehåller personuppgifter och fakturor.`);
  }
  return rot;
}
