-- AlterTable
ALTER TABLE "Participant" ADD COLUMN "cedula" TEXT;

-- CreateIndex
CREATE INDEX "Participant_cedula_idx" ON "Participant"("cedula");
