/**
 * Money helpers, safe to use in both server and browser code.
 * Every price is stored in US dollars; francs are worked out from the day's rate.
 */
export type Decimalish = { toString(): string } | number | string | null | undefined;

/** Prisma Decimal, string or number → plain number (or null when empty). */
export function toNumber(v: Decimalish): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(typeof v === 'number' ? v : v.toString());
  return Number.isFinite(n) ? n : null;
}

/** $1,299 or $14.50 */
export function usd(v: Decimalish): string {
  const n = toNumber(v);
  if (n === null) return '—';
  return (
    '$' +
    n.toLocaleString('en-US', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/** 396 150 FC — rounded to the whole franc. */
export function cdf(usdValue: Decimalish, rate: Decimalish): string {
  const n = toNumber(usdValue);
  const r = toNumber(rate);
  if (n === null || r === null) return '—';
  return Math.round(n * r).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' FC';
}
