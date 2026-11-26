-- Client #30: farms request new items; the Admin approves (creates the Item) or rejects.
CREATE TYPE "ItemRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "ItemRequest" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameUr" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "status" "ItemRequestStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "itemId" TEXT,

    CONSTRAINT "ItemRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemRequest_status_idx" ON "ItemRequest"("status");
CREATE INDEX "ItemRequest_farmId_status_idx" ON "ItemRequest"("farmId", "status");
