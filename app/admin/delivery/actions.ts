'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { DELIVERY_METHODS, KINSHASA_COMMUNES } from '@/lib/delivery-fees';

/** Prices are money decisions: only Administrators can change them. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'ADMIN') throw new Error('Not authorised');
}

const Money = z.coerce.number().min(0).max(1000).transform((n) => Math.round(n * 100) / 100);

/** Saves the price and on/off switch of every delivery type in one go. */
export async function saveDeliveryOptions(formData: FormData): Promise<void> {
  await requireAdmin();
  const rows = [];
  for (const m of DELIVERY_METHODS) {
    const fee = Money.safeParse(formData.get(`fee_${m.id}`));
    if (!fee.success) return;
    rows.push({ method: m.id, feeUsd: fee.data, isActive: formData.get(`active_${m.id}`) === 'on' });
  }
  await prisma.$transaction(
    rows.map((r) =>
      prisma.deliveryOption.upsert({
        where: { method: r.method },
        update: { feeUsd: r.feeUsd, isActive: r.isActive },
        create: r,
      }),
    ),
  );
  refresh();
}

/** Saves, for all 24 communes, whether Soko delivers there and any extra charge. */
export async function saveCommunes(formData: FormData): Promise<void> {
  await requireAdmin();
  const rows = [];
  for (const name of KINSHASA_COMMUNES) {
    const extra = Money.safeParse(formData.get(`extra_${name}`) || 0);
    if (!extra.success) return;
    rows.push({ name, isServed: formData.get(`served_${name}`) === 'on', surchargeUsd: extra.data });
  }
  await prisma.$transaction(
    rows.map((r) =>
      prisma.communeSetting.upsert({
        where: { name: r.name },
        update: { isServed: r.isServed, surchargeUsd: r.surchargeUsd },
        create: r,
      }),
    ),
  );
  refresh();
}
