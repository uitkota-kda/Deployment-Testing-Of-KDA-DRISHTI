/*
  Warnings:

  - Made the column `stageKey` on table `ProjectWorkflow` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProjectWorkflow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stageKey" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "date" DATETIME,
    "value" TEXT,
    "reason" TEXT,
    "projectId" INTEGER NOT NULL,
    CONSTRAINT "ProjectWorkflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProjectWorkflow" ("date", "id", "isCompleted", "projectId", "reason", "stageKey", "stepName", "value") SELECT "date", "id", "isCompleted", "projectId", "reason", "stageKey", "stepName", "value" FROM "ProjectWorkflow";
DROP TABLE "ProjectWorkflow";
ALTER TABLE "new_ProjectWorkflow" RENAME TO "ProjectWorkflow";
CREATE UNIQUE INDEX "ProjectWorkflow_projectId_stageKey_key" ON "ProjectWorkflow"("projectId", "stageKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
