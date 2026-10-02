// Ett id ur adressraden ar anvandarens inmatning – en gammal lank, ett
// felskrivet tecken. Tabellernas id ar uuid, och Postgres avvisar allt annat
// med ett fel (Prisma P2023) som annars nar felgransen: "Något gick fel" for
// nagot som bara inte finns (docs/design.md, "Sidan finns inte, och när något
// gick fel": en sak som inte finns ar inte ett fel). Provas innan fragan stalls.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function arGiltigtId(id: string): boolean {
  return UUID.test(id);
}
