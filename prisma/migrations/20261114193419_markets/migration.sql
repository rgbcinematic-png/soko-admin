-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "marketId" TEXT NOT NULL DEFAULT 'CD';

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paymentMethods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- The two markets. Existing orders all belong to RD Congo (the column default above).
-- Europe stays switched off until Level 2 (prices in EUR, card payments).
INSERT INTO "Market" ("id", "name", "currency", "countries", "paymentMethods", "isActive", "position", "updatedAt") VALUES
  ('CD', 'RD Congo', 'USD', ARRAY['CD'], ARRAY['CASH_ON_DELIVERY']::"PaymentMethod"[], true, 0, CURRENT_TIMESTAMP),
  ('EU', 'Europe', 'EUR', ARRAY[]::TEXT[], ARRAY['CARD']::"PaymentMethod"[], false, 1, CURRENT_TIMESTAMP);

-- CreateIndex
CREATE INDEX "Order_marketId_createdAt_idx" ON "Order"("marketId", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
