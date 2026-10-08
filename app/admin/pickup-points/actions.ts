'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { KINSHASA_COMMUNES } from '@/lib/delivery-fees';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authorised');
}

const PointInput = z.object({
  name: z.string().trim().min(2).max(80),
  commune: z.enum(KINSHASA_COMMUNES),
  landmark: z.string().trim().min(3).max(200),
  phone: z.string().trim().max(24).optional(),
  openingHours: z.string().trim().max(80).optional(),
});

export async function addPickupPoint(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = PointInput.safeParse({
    name: formData.get('name'),
    commune: formData.get('commune'),
    landmark: formData.get('landmark'),
    phone: formData.get('phone') || undefined,
    openingHours: formData.get('openingHours') || undefined,
  });
  if (!parsed.success) return;
  const d = parsed.data;
  await prisma.pickupPoint.create({
    data: { ...d, phone: d.phone || null, openingHours: d.openingHours || null },
  });
  refresh();
}

export async function togglePickupPoint(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get('id') ?? '');
  const point = id ? await prisma.pickupPoint.findUnique({ where: { id } }) : null;
  if (!point) return;
  await prisma.pickupPoint.update({ where: { id }, data: { isActive: !point.isActive } });
  refresh();
}
