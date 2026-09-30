-- Samagande, del 2 (docs/design.md, "Att bjuda in en delagare"). Additiv: en
-- ny enum och en ny tabell. Ingenting befintligt andras.

-- CreateEnum
CREATE TYPE "inbjudningsstatus" AS ENUM ('utestaende', 'accepterad', 'aterkallad');

-- CreateTable
CREATE TABLE "inbjudan" (
    "id" UUID NOT NULL,
    "bostad_id" UUID NOT NULL,
    "epost" TEXT NOT NULL,
    "inbjuden_av" UUID,
    "status" "inbjudningsstatus" NOT NULL DEFAULT 'utestaende',
    "besvarad_at" TIMESTAMP(3),
    "skapad_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbjudan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbjudan_epost_status_idx" ON "inbjudan"("epost", "status");

-- CreateIndex
CREATE INDEX "inbjudan_bostad_id_status_idx" ON "inbjudan"("bostad_id", "status");

-- AddForeignKey
ALTER TABLE "inbjudan" ADD CONSTRAINT "inbjudan_bostad_id_fkey" FOREIGN KEY ("bostad_id") REFERENCES "bostad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbjudan" ADD CONSTRAINT "inbjudan_inbjuden_av_fkey" FOREIGN KEY ("inbjuden_av") REFERENCES "anvandare"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS pa, utan policyer: neka allt via PostgREST (CLAUDE.md, "RLS ar paslaget
-- pa varje tabell i public"). Postgres standard ar avslaget.
ALTER TABLE "inbjudan" ENABLE ROW LEVEL SECURITY;
