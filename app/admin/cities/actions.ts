'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { cityIdFrom, cityReadiness } from '@/lib/cities';

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
