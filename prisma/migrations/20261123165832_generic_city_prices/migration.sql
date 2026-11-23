-- CreateEnum
CREATE TYPE "CityPricing" AS ENUM ('GENERIC', 'EXACT', 'OFF');

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "priceAdjustPct" DECIMAL(6,2) NOT NULL DEFAULT 0,
ADD COLUMN     "priceRoundUsd" DECIMAL(12,2) NOT NULL DEFAULT 0.01;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "genericCompareAtUsd" DECIMAL(12,2),
ADD COLUMN     "genericPriceUsd" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "VariantCity" ADD COLUMN     "pricing" "CityPricing" NOT NULL DEFAULT 'OFF';

-- Data: every price shoppers see stays exactly the same.
-- 1. Each variant's generic price = its Kinshasa price, or else the price in the first city (by position) that has one.
UPDATE "ProductVariant" v
SET "genericPriceUsd" = src."priceUsd", "genericCompareAtUsd" = src."compareAtUsd"
FROM (
  SELECT DISTINCT ON (vc."variantId") vc."variantId", vc."priceUsd", vc."compareAtUsd"
  FROM "VariantCity" vc
  JOIN "City" c ON c.id = vc."cityId"
  WHERE vc."priceUsd" IS NOT NULL
  ORDER BY vc."variantId", (vc."cityId" = 'kinshasa') DESC, c.position, c.id
) src
WHERE v.id = src."variantId";

-- 2. Every city starts at +0 %, so a city whose price equals the generic one follows it (GENERIC);
--    a different price is kept as typed (EXACT); no price stays not sold (OFF, the default).
UPDATE "VariantCity" vc
SET "pricing" = CASE
  WHEN vc."priceUsd" = v."genericPriceUsd"
   AND vc."compareAtUsd" IS NOT DISTINCT FROM v."genericCompareAtUsd" THEN 'GENERIC'::"CityPricing"
  ELSE 'EXACT'::"CityPricing"
END
FROM "ProductVariant" v
WHERE v.id = vc."variantId" AND vc."priceUsd" IS NOT NULL;
