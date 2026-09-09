import { PrismaClient } from "@prisma/client";
import {
  DEV_ANVANDARE,
  SEED_BOSTAD,
  SEED_KOSTNADER,
  SEED_MEDLEMSKAP,
  SEED_PROJEKT,
  SEED_REGELPARAMETRAR,
} from "../src/doman/seeddata";

const prisma = new PrismaClient();

/** "YYYY-MM-DD" -> Date vid midnatt UTC. Kolumnerna ar @db.Date, tid slangs bort. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Seeden ar idempotent och radar bara sina EGNA rader, aldrig hela tabeller.
// Riktiga Supabase-inloggade konton (annat id, annan epost) ror den aldrig.
async function main() {
  // 1. Regelparametrar ar global konfiguration, inte anvandardata. Aterstall
  //    bara de nycklar seeden ager – ev. senare tillagda parametrar lamnas kvar.
  const seedNycklar = [...new Set(SEED_REGELPARAMETRAR.map((p) => p.nyckel))];
  await prisma.regelparameter.deleteMany({
    where: { nyckel: { in: seedNycklar } },
  });
  await prisma.regelparameter.createMany({
    data: SEED_REGELPARAMETRAR.map((p) => ({
      nyckel: p.nyckel,
      varde: p.varde,
      enhet: p.enhet,
      giltig_fran: d(p.giltig_fran),
      giltig_till: p.giltig_till ? d(p.giltig_till) : null,
      kalla: "produktspec.md avsnitt 5 / docs/regelkallor.md",
    })),
  });

  // 2. Seed-bostaden identifieras pa sitt fasta id. Att radera den tar hela
  //    tradet via cascader: medlemskap, projekt, kostnader, rader, fordelningar,
  //    bilagor. Ingen annan bostad beros.
  await prisma.bostad.deleteMany({ where: { id: SEED_BOSTAD.id } });

  // 3. Seed-anvandaren: fast id och en sentinel-epost pa .local som ingen riktig
  //    anvandare kan registrera. Bada villkoren gor att detta aldrig krockar med
  //    ett inloggat konto.
  await prisma.anvandare.deleteMany({
    where: { OR: [{ id: DEV_ANVANDARE.id }, { epost: DEV_ANVANDARE.epost }] },
  });

  await prisma.anvandare.create({
    data: { id: DEV_ANVANDARE.id, epost: DEV_ANVANDARE.epost },
  });

  await prisma.bostad.create({
    data: {
      id: SEED_BOSTAD.id,
      namn: SEED_BOSTAD.namn,
      upplatelseform: SEED_BOSTAD.upplatelseform,
      tilltradesdatum: d(SEED_BOSTAD.tilltradesdatum),
      forsaljningsdatum: SEED_BOSTAD.forsaljningsdatum
        ? d(SEED_BOSTAD.forsaljningsdatum)
        : null,
      medlemskap: {
        create: {
          anvandare_id: DEV_ANVANDARE.id,
          agarandel: SEED_MEDLEMSKAP.agarandel,
        },
      },
    },
  });

  for (const p of SEED_PROJEKT) {
    await prisma.projekt.create({
      data: {
        id: p.id,
        bostad_id: p.bostad_id,
        namn: p.namn,
        ar: p.ar,
        kategori: p.kategori,
        motivering: p.motivering,
        slitet_vid_tilltrade: p.slitet_vid_tilltrade,
        battre_skick_vid_forsaljning: p.battre_skick_vid_forsaljning,
        kvarvarande_andel: p.kvarvarande_andel,
      },
    });
  }

  for (const k of SEED_KOSTNADER) {
    await prisma.kostnad.create({
      data: {
        id: k.id,
        bostad_id: k.bostad_id,
        leverantor: k.leverantor,
        totalbelopp: k.totalbelopp,
        dokumentdatum: d(k.dokumentdatum),
        betaldatum: k.betaldatum ? d(k.betaldatum) : null,
        anlitad_entreprenor: k.anlitad_entreprenor,
        arbetskostnad: k.arbetskostnad,
        materialkostnad: k.materialkostnad,
        rot_utnyttjat: k.rot_utnyttjat,
        forsakringsersattning: k.forsakringsersattning,
        arkiverad: k.arkiverad,
        rader: {
          create: k.rader.map((rad) => ({
            artikel: rad.artikel,
            belopp: rad.belopp,
            fordelningar: {
              create: rad.fordelningar.map((f) => ({
                projekt_id: f.projekt_id,
                privat: f.privat,
                andel: f.andel,
              })),
            },
          })),
        },
      },
    });
  }

  console.log(
    "Seed klar (idempotent): 2 regelparametrar, seed-bostad + seed-anvandare, 3 projekt, 3 kostnader.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
