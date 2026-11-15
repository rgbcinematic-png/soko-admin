/*
  Warnings:

  - The primary key for the `CommuneSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DeliveryOption` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "CommuneSetting" DROP CONSTRAINT "CommuneSetting_pkey",
ADD COLUMN     "cityId" TEXT NOT NULL DEFAULT 'kinshasa',
ADD CONSTRAINT "CommuneSetting_pkey" PRIMARY KEY ("cityId", "name");

-- AlterTable
ALTER TABLE "DeliveryOption" DROP CONSTRAINT "DeliveryOption_pkey",
ADD COLUMN     "cityId" TEXT NOT NULL DEFAULT 'kinshasa',
ADD CONSTRAINT "DeliveryOption_pkey" PRIMARY KEY ("cityId", "method");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cityId" TEXT NOT NULL DEFAULT 'kinshasa';

-- AlterTable
ALTER TABLE "PickupPoint" ADD COLUMN     "cityId" TEXT NOT NULL DEFAULT 'kinshasa';

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "priceUsd" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "cityId" TEXT NOT NULL DEFAULT 'kinshasa';

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantCity" (
    "variantId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "priceUsd" DECIMAL(12,2),
    "compareAtUsd" DECIMAL(12,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantCity_pkey" PRIMARY KEY ("variantId","cityId")
);

-- Data: the three DRC cities. Only Kinshasa is open; the others are opened from the admin
-- once their prices, stock and delivery prices are filled in.
INSERT INTO "City" ("id", "name", "marketId", "isActive", "position", "updatedAt") VALUES
  ('kinshasa', 'Kinshasa', 'CD', true, 0, now()),
  ('lubumbashi', 'Lubumbashi', 'CD', false, 1, now()),
  ('matadi', 'Matadi', 'CD', false, 2, now());

-- Data: today's prices and stock become Kinshasa's.
INSERT INTO "VariantCity" ("variantId", "cityId", "priceUsd", "compareAtUsd", "stock", "updatedAt")
SELECT "id", 'kinshasa', "priceUsd", "compareAtUsd", "stock", now() FROM "ProductVariant";

-- Data: pickup points keep the city they were entered with.
UPDATE "PickupPoint" SET "cityId" = CASE lower("city")
  WHEN 'lubumbashi' THEN 'lubumbashi' WHEN 'matadi' THEN 'matadi' ELSE 'kinshasa' END;

-- Data: Kinshasa delivery types that were never saved used these default prices; write them down
-- so every city's prices are explicit. Lubumbashi and Matadi get none until they are set in the admin.
INSERT INTO "DeliveryOption" ("cityId", "method", "feeUsd", "isActive", "updatedAt") VALUES
  ('kinshasa', 'EXPRESS_MOTO', 5, true, now()),
  ('kinshasa', 'STANDARD', 3, true, now()),
  ('kinshasa', 'BIG_ITEM', 15, true, now()),
  ('kinshasa', 'PICKUP', 0, true, now())
ON CONFLICT ("cityId", "method") DO NOTHING;

-- Data: every commune of each city (saved Kinshasa settings are kept).
INSERT INTO "CommuneSetting" ("cityId", "name", "updatedAt") VALUES
  ('kinshasa', 'Bandalungwa', now()),
  ('kinshasa', 'Barumbu', now()),
  ('kinshasa', 'Bumbu', now()),
  ('kinshasa', 'Gombe', now()),
  ('kinshasa', 'Kalamu', now()),
  ('kinshasa', 'Kasa-Vubu', now()),
  ('kinshasa', 'Kimbanseke', now()),
  ('kinshasa', 'Kinshasa', now()),
  ('kinshasa', 'Kintambo', now()),
  ('kinshasa', 'Kisenso', now()),
  ('kinshasa', 'Lemba', now()),
  ('kinshasa', 'Limete', now()),
  ('kinshasa', 'Lingwala', now()),
  ('kinshasa', 'Makala', now()),
  ('kinshasa', 'Maluku', now()),
  ('kinshasa', 'Masina', now()),
  ('kinshasa', 'Matete', now()),
  ('kinshasa', 'Mont-Ngafula', now()),
  ('kinshasa', 'Ndjili', now()),
  ('kinshasa', 'Ngaba', now()),
  ('kinshasa', 'Ngaliema', now()),
  ('kinshasa', 'Ngiri-Ngiri', now()),
  ('kinshasa', 'Nsele', now()),
  ('kinshasa', 'Selembao', now()),
  ('lubumbashi', 'Annexe', now()),
  ('lubumbashi', 'Kamalondo', now()),
  ('lubumbashi', 'Kampemba', now()),
  ('lubumbashi', 'Katuba', now()),
  ('lubumbashi', 'Kenya', now()),
  ('lubumbashi', 'Lubumbashi', now()),
  ('lubumbashi', 'Rwashi', now()),
  ('matadi', 'Matadi', now()),
  ('matadi', 'Mvuzi', now()),
  ('matadi', 'Nzanza', now())
ON CONFLICT ("cityId", "name") DO NOTHING;

-- CreateIndex
CREATE INDEX "City_marketId_position_idx" ON "City"("marketId", "position");

-- CreateIndex
CREATE INDEX "VariantCity_cityId_stock_idx" ON "VariantCity"("cityId", "stock");

-- CreateIndex
CREATE INDEX "Order_cityId_status_createdAt_idx" ON "Order"("cityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PickupPoint_cityId_isActive_idx" ON "PickupPoint"("cityId", "isActive");

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantCity" ADD CONSTRAINT "VariantCity_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantCity" ADD CONSTRAINT "VariantCity_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPoint" ADD CONSTRAINT "PickupPoint_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOption" ADD CONSTRAINT "DeliveryOption_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommuneSetting" ADD CONSTRAINT "CommuneSetting_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
