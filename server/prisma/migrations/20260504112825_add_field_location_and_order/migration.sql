-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProjectField" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fieldKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT NOT NULL DEFAULT 'MASTER',
    "sequenceOrder" INTEGER NOT NULL DEFAULT 0,
    "versionId" INTEGER NOT NULL,
    CONSTRAINT "ProjectField_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ConfigVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProjectField" ("displayName", "fieldKey", "fieldType", "id", "isActive", "isRequired", "versionId") SELECT "displayName", "fieldKey", "fieldType", "id", "isActive", "isRequired", "versionId" FROM "ProjectField";
DROP TABLE "ProjectField";
ALTER TABLE "new_ProjectField" RENAME TO "ProjectField";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
