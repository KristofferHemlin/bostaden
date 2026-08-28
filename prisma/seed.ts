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

async function main() {
  // Aterstall. Cascades tar projekt, kostnader, rader, fordelningar, medlemskap.
  await prisma.regelparameter.deleteMany();
  await prisma.bostad.deleteMany();
  await prisma.anvandare.deleteMany();

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
        baslinjepost_id: p.baslinjepost_id,
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
    "Seed klar: 2 regelparametrar, 1 bostad + medlemskap, 3 projekt, 3 kostnader (Bauhaus-kvittot + 2 fiktiva).",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
