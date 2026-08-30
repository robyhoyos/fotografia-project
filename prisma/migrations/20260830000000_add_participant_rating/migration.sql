-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cedula" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" REAL,
    "items" JSONB,
    "totalAmount" REAL NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "paymentStatus" TEXT NOT NULL DEFAULT 'SIN_PAGO',
    "paidAmount" REAL NOT NULL DEFAULT 0.0,
    "deliveredAt" DATETIME,
    "rating" INTEGER,
    "barcode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Participant" ("barcode", "cedula", "createdAt", "deliveredAt", "email", "eventId", "id", "items", "name", "notes", "paidAmount", "paymentStatus", "phone", "quantity", "status", "totalAmount", "unitPrice", "updatedAt") SELECT "barcode", "cedula", "createdAt", "deliveredAt", "email", "eventId", "id", "items", "name", "notes", "paidAmount", "paymentStatus", "phone", "quantity", "status", "totalAmount", "unitPrice", "updatedAt" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
CREATE UNIQUE INDEX "Participant_barcode_key" ON "Participant"("barcode");
CREATE INDEX "Participant_eventId_idx" ON "Participant"("eventId");
CREATE INDEX "Participant_status_idx" ON "Participant"("status");
CREATE INDEX "Participant_paymentStatus_idx" ON "Participant"("paymentStatus");
CREATE INDEX "Participant_cedula_idx" ON "Participant"("cedula");
CREATE INDEX "Participant_barcode_idx" ON "Participant"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;