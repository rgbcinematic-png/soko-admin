-- AlterTable
ALTER TABLE "Courier" ADD COLUMN     "cityId" TEXT NOT NULL DEFAULT 'kinshasa';

-- AlterTable
ALTER TABLE "VariantCity" ADD COLUMN     "costUsd" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ProductCity" (
    "productId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "installPriceUsd" DECIMAL(12,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCity_pkey" PRIMARY KEY ("productId","cityId")
);

-- AddForeignKey
ALTER TABLE "ProductCity" ADD CONSTRAINT "ProductCity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCity" ADD CONSTRAINT "ProductCity_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data: today's cost becomes Kinshasa's. Other cities get their own cost in the admin.
UPDATE "VariantCity" vc SET "costUsd" = v."costUsd"
FROM "ProductVariant" v
WHERE vc."variantId" = v."id" AND vc."cityId" = 'kinshasa' AND v."costUsd" IS NOT NULL;

-- Data: today's installation price becomes Kinshasa's.
INSERT INTO "ProductCity" ("productId", "cityId", "installPriceUsd", "updatedAt")
SELECT "id", 'kinshasa', "installPriceUsd", now() FROM "Product"
WHERE "installPriceUsd" IS NOT NULL;

-- Existing couriers deliver in Kinshasa (the column default).
