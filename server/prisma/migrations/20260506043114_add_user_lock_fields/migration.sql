-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mobile" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '123456',
    "designation" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "failed_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "locked_at" DATETIME,
    "last_failed_login_at" DATETIME,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("designation", "id", "isDeleted", "mobile", "name", "password", "role") SELECT "designation", "id", "isDeleted", "mobile", "name", "password", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
