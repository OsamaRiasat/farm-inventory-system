-- CreateEnum
CREATE TYPE "FarmType" AS ENUM ('breeder', 'layer', 'hatchery');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('KG', 'LTR', 'QTY', 'BG', 'ROLL', 'VIAL');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('farm', 'admin');

-- CreateEnum
CREATE TYPE "SlipType" AS ENUM ('IGP', 'OGP', 'SIS');

-- CreateEnum
CREATE TYPE "SlipStatus" AS ENUM ('saved', 'corrected', 'cancelled');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('in_transit', 'received', 'short', 'cancelled');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('saved', 'cancelled');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('open', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FarmType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shed" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "Shed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameUr" TEXT NOT NULL DEFAULT '',
    "aliases" TEXT[],
    "category" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "isFeed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "farmId" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "name" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Slip" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "paperNo" TEXT NOT NULL,
    "paperNoKey" TEXT NOT NULL,
    "type" "SlipType" NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "postedAt" TEXT NOT NULL,
    "preparedBy" TEXT NOT NULL,
    "status" "SlipStatus" NOT NULL DEFAULT 'saved',
    "correctionOf" TEXT,
    "correctedBy" TEXT,
    "transferId" TEXT,
    "remarks" TEXT,
    "sourceKind" TEXT,
    "sourceFarmId" TEXT,
    "sourceMs" TEXT,
    "biltyNo" TEXT,
    "truckNo" TEXT,
    "demandNo" TEXT,
    "challanNo" TEXT,
    "challanDate" TEXT,
    "driverName" TEXT,
    "toKind" TEXT,
    "toFarmId" TEXT,
    "toMs" TEXT,
    "toReason" TEXT,
    "vehicleNo" TEXT,
    "shedRows" JSONB,

    CONSTRAINT "Slip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlipLine" (
    "slipId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION,
    "qtyChallan" DOUBLE PRECISION,
    "qtyReceived" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "ledgerFolio" TEXT,
    "purpose" TEXT,
    "shedId" TEXT,

    CONSTRAINT "SlipLine_pkey" PRIMARY KEY ("slipId","index")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "ogpId" TEXT NOT NULL,
    "igpId" TEXT,
    "fromFarmId" TEXT NOT NULL,
    "toFarmId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL,
    "sentAt" TEXT NOT NULL,
    "receivedAt" TEXT,
    "resolutionKind" TEXT,
    "resolutionBy" TEXT,
    "resolutionAt" TEXT,
    "resolutionReason" TEXT,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" SERIAL NOT NULL,
    "farmId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "qtyIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyOut" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisReturn" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "sisId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "postedAt" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'saved',
    "cancelledBy" TEXT,
    "cancelledAt" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "SisReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisReturnLine" (
    "returnId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SisReturnLine_pkey" PRIMARY KEY ("returnId","index")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "preparedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountLine" (
    "countId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "systemQty" DOUBLE PRECISION NOT NULL,
    "countedQty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("countId","index")
);

-- CreateTable
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "requestedQty" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "at" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'open',
    "note" TEXT,
    "correctionId" TEXT,

    CONSTRAINT "CorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "farmId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("farmId","kind")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" SERIAL NOT NULL,
    "at" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "farmId" TEXT,
    "action" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordNo" TEXT NOT NULL,
    "old" TEXT,
    "new" TEXT,
    "reason" TEXT,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Farm_code_key" ON "Farm"("code");

-- CreateIndex
CREATE INDEX "Shed_farmId_idx" ON "Shed"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_number_key" ON "Item"("number");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Slip_no_key" ON "Slip"("no");

-- CreateIndex
CREATE INDEX "Slip_farmId_date_idx" ON "Slip"("farmId", "date");

-- CreateIndex
CREATE INDEX "Slip_date_idx" ON "Slip"("date");

-- CreateIndex
CREATE INDEX "Slip_transferId_idx" ON "Slip"("transferId");

-- CreateIndex
CREATE INDEX "SlipLine_itemId_idx" ON "SlipLine"("itemId");

-- CreateIndex
CREATE INDEX "Transfer_toFarmId_status_idx" ON "Transfer"("toFarmId", "status");

-- CreateIndex
CREATE INDEX "Transfer_fromFarmId_idx" ON "Transfer"("fromFarmId");

-- CreateIndex
CREATE INDEX "Movement_farmId_itemId_idx" ON "Movement"("farmId", "itemId");

-- CreateIndex
CREATE INDEX "Movement_slipId_idx" ON "Movement"("slipId");

-- CreateIndex
CREATE UNIQUE INDEX "SisReturn_no_key" ON "SisReturn"("no");

-- CreateIndex
CREATE INDEX "SisReturn_sisId_idx" ON "SisReturn"("sisId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_no_key" ON "StockCount"("no");

-- CreateIndex
CREATE INDEX "CorrectionRequest_farmId_status_idx" ON "CorrectionRequest"("farmId", "status");

-- CreateIndex
CREATE INDEX "AuditEntry_farmId_idx" ON "AuditEntry"("farmId");

-- CreateIndex
CREATE INDEX "AuditEntry_at_idx" ON "AuditEntry"("at");

-- AddForeignKey
ALTER TABLE "Shed" ADD CONSTRAINT "Shed_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlipLine" ADD CONSTRAINT "SlipLine_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "Slip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisReturnLine" ADD CONSTRAINT "SisReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SisReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Hand-written ─────────────────────────────────────────────────────────

-- Paper slip No.: unique per farm + type among original slips (corrections keep the original's No.).
CREATE UNIQUE INDEX "Slip_paperNo_unique" ON "Slip"("farmId", "type", "paperNoKey") WHERE "correctionOf" IS NULL;

-- Nobody can edit or remove the audit log (requirements).
CREATE FUNCTION audit_entry_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'The audit log cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_entry_append_only
  BEFORE UPDATE OR DELETE ON "AuditEntry"
  FOR EACH ROW EXECUTE FUNCTION audit_entry_append_only();

CREATE TRIGGER audit_entry_no_truncate
  BEFORE TRUNCATE ON "AuditEntry"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_entry_append_only();
