-- AlterTable
ALTER TABLE "Project" ADD COLUMN "bidFinEvalCompleted" TEXT DEFAULT 'No';
ALTER TABLE "Project" ADD COLUMN "bidFinEvalDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "bidFinEvalDelayReason" TEXT;
ALTER TABLE "Project" ADD COLUMN "bidTechEvalCompleted" TEXT DEFAULT 'No';
ALTER TABLE "Project" ADD COLUMN "bidTechEvalDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "bidTechEvalDelayReason" TEXT;
