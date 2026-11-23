/**
 * Generic prices and city adjustments, safe to use in both server and browser code.
 * A variant has one generic price; each city sells it at that price plus the city's %,
 * rounded up to the city's step — unless the city has an exact price, or doesn't sell it.
 */
import { toNumber, type Decimalish } from '@/lib/money';

export type CityPricingMode = 'GENERIC' | 'EXACT' | 'OFF';

/** A city's price settings. */
export type CityAdjust = { priceAdjustPct: Decimalish; priceRoundUsd: Decimalish };

/** Round-up steps offered on the Cities page, in dollars. 0.01 means "no rounding". */
export const ROUND_STEPS = [0.01, 0.5, 1, 5, 10] as const;

export const MIN_ADJUST_PCT = -50;
export const MAX_ADJUST_PCT = 200;

/**
 * The generic price in one city: +pct %, then rounded UP to the step so the city never ends up
 * below its %. At +0 % the generic price is used as it is.
 */
export function adjustedPrice(generic: Decimalish, city: CityAdjust): number | null {
  const base = toNumber(generic);
  if (base === null) return null;
  const pct = toNumber(city.priceAdjustPct) ?? 0;
  const baseCents = Math.round(base * 100);
  if (pct === 0) return baseCents / 100;
  const cents = Math.round((baseCents * (100 + pct)) / 100);
  const step = Math.max(1, Math.round((toNumber(city.priceRoundUsd) ?? 0.01) * 100));
  return (Math.ceil(cents / step) * step) / 100;
}

/** "+10 %", "−5 %", "+0 %" */
export function pctLabel(pct: Decimalish): string {
  const n = toNumber(pct) ?? 0;
  return `${n < 0 ? '−' : '+'}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })} %`;
}

/** "no rounding", "round up to $1" */
export function roundLabel(step: Decimalish): string {
  const n = toNumber(step) ?? 0.01;
  return n <= 0.01 ? 'no rounding' : `round up to $${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
}

/**
 * What a city row saves as the price shoppers pay. GENERIC follows the generic price and the city's %;
 * EXACT keeps what was typed; OFF is not sold.
 */
export function effectivePrices(
  mode: CityPricingMode,
  generic: { priceUsd: Decimalish; compareAtUsd: Decimalish },
  exact: { priceUsd: Decimalish; compareAtUsd: Decimalish },
  city: CityAdjust,
): { priceUsd: number | null; compareAtUsd: number | null } {
  if (mode === 'OFF') return { priceUsd: null, compareAtUsd: null };
  if (mode === 'EXACT') return { priceUsd: toNumber(exact.priceUsd), compareAtUsd: toNumber(exact.compareAtUsd) };
  return { priceUsd: adjustedPrice(generic.priceUsd, city), compareAtUsd: adjustedPrice(generic.compareAtUsd, city) };
}
