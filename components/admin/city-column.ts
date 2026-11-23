import type { City } from '@prisma/client';
import { toNumber } from '@/lib/money';
import type { CityColumn } from './VariantsField';

/** A city as the product form needs it: plain numbers, safe to pass to the browser. */
export const cityColumn = (c: City): CityColumn => ({
  id: c.id,
  name: c.name,
  isActive: c.isActive,
  priceAdjustPct: toNumber(c.priceAdjustPct) ?? 0,
  priceRoundUsd: toNumber(c.priceRoundUsd) ?? 0.01,
});
