/*
  Warnings:

  - You are about to drop the `WorkflowStep` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "ProjectUpdate" ADD COLUMN "expectedCompletionDate" DATETIME;
ALTER TABLE "ProjectUpdate" ADD COLUMN "overallStatus" TEXT;
ALTER TABLE "ProjectUpdate" ADD COLUMN "qualitySampling" TEXT DEFAULT 'No';
ALTER TABLE "ProjectUpdate" ADD COLUMN "qualitySamplingReason" TEXT DEFAULT '';
ALTER TABLE "ProjectUpdate" ADD COLUMN "statusDelayBrief" TEXT;
ALTER TABLE "ProjectUpdate" ADD COLUMN "statusDelayReasons" TEXT;
ALTER TABLE "ProjectUpdate" ADD COLUMN "statusHoldReason" TEXT;
ALTER TABLE "ProjectUpdate" ADD COLUMN "timeExtension" TEXT;
ALTER TABLE "ProjectUpdate" ADD COLUMN "todaysUpdateNote" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WorkflowStep";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "versionNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stageKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "versionId" INTEGER NOT NULL,
    CONSTRAINT "ProjectStage_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ConfigVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectField" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fieldKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "versionId" INTEGER NOT NULL,
    CONSTRAINT "ProjectField_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ConfigVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectDirection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "direction" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "ProjectDirection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectDirection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectWorkflow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stepName" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "date" DATETIME,
    "value" TEXT,
    "reason" TEXT,
    "projectId" INTEGER NOT NULL,
    CONSTRAINT "ProjectWorkflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "consultancySource" TEXT DEFAULT 'NIT',
    "brief" TEXT NOT NULL DEFAULT '',
    "fundingAgency" TEXT NOT NULL,
    "estimatedCost" REAL NOT NULL,
    "inchargeName" TEXT NOT NULL,
    "inchargeMobile" TEXT NOT NULL,
    "consultantName" TEXT,
    "consultantMobile" TEXT,
    "contractorName" TEXT,
    "contractorMobile" TEXT,
    "actualStartDate" DATETIME,
    "stipulatedCompletionDate" DATETIME,
    "workStarted" TEXT NOT NULL DEFAULT 'No',
    "delayReasons" TEXT,
    "delayBrief" TEXT,
    "overallStatus" TEXT NOT NULL DEFAULT 'On Track',
    "statusHoldReason" TEXT,
    "statusDelayReasons" TEXT,
    "statusDelayBrief" TEXT,
    "todaysUpdateNote" TEXT DEFAULT '',
    "qualitySampling" TEXT DEFAULT 'No',
    "qualitySamplingReason" TEXT DEFAULT '',
    "expectedCompletionDate" DATETIME,
    "timeExtension" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "currentProgress" REAL NOT NULL DEFAULT 0,
    "gpsLat" REAL,
    "gpsLong" REAL,
    "configVersionId" INTEGER,
    "fieldData" TEXT,
    "stageData" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ConfigVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("brief", "consultantMobile", "consultantName", "contractorMobile", "contractorName", "createdAt", "currentProgress", "estimatedCost", "fundingAgency", "id", "inchargeMobile", "inchargeName", "isLegacy", "name", "status", "type", "updatedAt") SELECT "brief", "consultantMobile", "consultantName", "contractorMobile", "contractorName", "createdAt", "currentProgress", "estimatedCost", "fundingAgency", "id", "inchargeMobile", "inchargeName", "isLegacy", "name", "status", "type", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mobile" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '123456',
    "designation" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("id", "mobile", "name", "role") SELECT "id", "mobile", "name", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_versionNumber_key" ON "ConfigVersion"("versionNumber");
