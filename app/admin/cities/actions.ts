'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { cityIdFrom, cityReadiness, repriceCity, sellAllAtGeneric } from '@/lib/cities';
import { MAX_ADJUST_PCT, MIN_ADJUST_PCT, ROUND_STEPS, pctLabel, roundLabel } from '@/lib/city-pricing';

/** Opening or closing a city changes what shoppers can buy: only Administrators can. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') throw new Error('Not authorised');
}

/** Opens a ready city to shoppers, or closes an open one. */
export async function toggleCity(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = cityIdFrom(String(formData.get('cityId') ?? ''));
  const city = id ? await prisma.city.findUnique({ where: { id } }) : null;
  if (!city) return;

  let error = '';
  if (!city.isActive) {
    const { missing } = await cityReadiness(city.id);
    if (missing.length) error = `${city.name} cannot open yet: ${missing.join(' ')}`;
  } else {
    // The app needs at least one open city in each open market.
    const othersOpen = await prisma.city.count({ where: { marketId: city.marketId, isActive: true, id: { not: city.id } } });
    if (othersOpen === 0) error = `${city.name} is the only open city, so it cannot be closed.`;
  }
  if (error) redirect(`/admin/cities?error=${encodeURIComponent(error)}`);

  await prisma.city.update({ where: { id: city.id }, data: { isActive: !city.isActive } });
  refresh();
}

const back = (key: 'error' | 'saved', text: string) => redirect(`/admin/cities?${key}=${encodeURIComponent(text)}`);

const AdjustInput = z.object({
  pct: z.coerce
    .number({ message: 'enter a number, e.g. 10 or -5' })
    .min(MIN_ADJUST_PCT, `at least ${MIN_ADJUST_PCT} %`)
    .max(MAX_ADJUST_PCT, `at most +${MAX_ADJUST_PCT} %`)
    .refine((n) => Math.round(n * 100) === n * 100, 'at most 2 decimals'),
  round: z.coerce.number().refine((n) => (ROUND_STEPS as readonly number[]).includes(n), 'choose a rounding'),
});

/**
 * Saves a city's adjustment on the generic price, and updates at once every price there that follows it.
 * Changes what shoppers pay: only Administrators can.
 */
export async function setCityPricing(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = cityIdFrom(String(formData.get('cityId') ?? ''));
  const city = id ? await prisma.city.findUnique({ where: { id } }) : null;
  if (!city) return;
  const pctRaw = String(formData.get('pct') ?? '').trim().replace(',', '.').replace('−', '-').replace(/^\+/, '');
  const parsed = AdjustInput.safeParse({ pct: pctRaw === '' ? 0 : pctRaw, round: formData.get('round') });
  if (!parsed.success) return back('error', `${city.name} adjustment: ${parsed.error.issues[0]?.message ?? 'check it'}.`);
  const { pct, round } = parsed.data;

  const changed = await prisma.$transaction(
    async (tx) => {
      await tx.city.update({ where: { id: city.id }, data: { priceAdjustPct: pct, priceRoundUsd: round } });
      return repriceCity(tx, city.id);
    },
    { timeout: 60_000 },
  );
  back('saved', `${city.name}: generic price ${pctLabel(pct)}, ${roundLabel(round)}. ${changed} price${changed === 1 ? '' : 's'} updated.`);
}

/** Puts every product not sold in a city yet on the generic price there. Exact prices are kept. */
export async function sellAllGeneric(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = cityIdFrom(String(formData.get('cityId') ?? ''));
  const city = id ? await prisma.city.findUnique({ where: { id } }) : null;
  if (!city) return;
  const added = await prisma.$transaction((tx) => sellAllAtGeneric(tx, city.id), { timeout: 60_000 });
  back(
    'saved',
    added
      ? `${city.name}: ${added} variant${added === 1 ? '' : 's'} now sold at the generic price. Add stock to sell them.`
      : `${city.name}: every product with a generic price is already sold here.`,
  );
}
