// Kravet pa ett losenord – ETT stalle, sa att registreringen och sidan for nytt
// losenord (docs/design.md, Inloggningssidan) aldrig kan glida isar. Samma
// krav vid aterstallning som vid registrering, inte strangare.

export const LOSENORD_MINSTA_LANGD = 8;

/** Felbeskedet for ett for svagt losenord, eller null om det duger. */
export function losenordsfel(losenord: string): string | null {
  if (losenord.length < LOSENORD_MINSTA_LANGD) {
    return `Lösenordet måste vara minst ${LOSENORD_MINSTA_LANGD} tecken.`;
  }
  return null;
}
