'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { cityIdFrom } from '@/lib/cities';
import { normalizePhone } from '@/lib/orders';

export type CourierFormState = { error?: string; message?: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authorised');
}

const CourierInput = z.object({
  cityId: z.string().min(1, 'Choose a city.'),
  name: z.string().trim().min(2, 'Name: at least 2 characters.').max(80, 'Name: at most 80 characters.'),
  phone: z.string().trim().min(1, 'Enter the phone number.').max(24),
  vehicle: z.enum(['MOTO', 'VAN', 'CAR']),
});

/** Adds a courier who delivers in one city. */
export async function addCourier(_prev: CourierFormState, formData: FormData): Promise<CourierFormState> {
  await requireUser();
  const parsed = CourierInput.safeParse({
    cityId: cityIdFrom(String(formData.get('cityId') ?? '')) ?? '',
    name: formData.get('name'),
    phone: formData.get('phone'),
    vehicle: formData.get('vehicle'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { error: 'Phone: not a valid number. Example: 0812345678 or +243812345678.' };

  const city = await prisma.city.findUnique({ where: { id: d.cityId }, select: { id: true, name: true } });
  if (!city) return { error: 'That city no longer exists. Reload the page.' };
  // One courier per phone number, across all cities.
  const taken = await prisma.courier.findUnique({ where: { phone }, include: { city: { select: { name: true } } } });
  if (taken) return { error: `${phone} already belongs to ${taken.name} (${taken.city.name}).` };

  await prisma.courier.create({ data: { name: d.name, phone, vehicle: d.vehicle, cityId: city.id } });
  refresh();
  return { message: `${d.name} added in ${city.name}.` };
}

/** Switches a courier on or off. Switched-off couriers can't be given new orders. */
export async function toggleCourier(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get('id') ?? '');
  const courier = id ? await prisma.courier.findUnique({ where: { id } }) : null;
  if (!courier) return;
  await prisma.courier.update({ where: { id }, data: { isActive: !courier.isActive } });
  refresh();
}

/** Statuses where an order can still be given to, or taken from, a courier. */
const ASSIGNABLE = ['CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY'] as const;

/** Gives a home-delivery order to a courier of the same city, or takes it back (empty courier). */
export async function assignCourier(formData: FormData): Promise<void> {
  await requireUser();
  const orderId = String(formData.get('orderId') ?? '');
  const courierId = String(formData.get('courierId') ?? '');
  const order = orderId
    ? await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, cityId: true, status: true, pickupPointId: true } })
    : null;
  if (!order) return;

  let message: string | null = null;
  if (order.pickupPointId) message = 'This order is collected at a pickup point: it has no courier.';
  else if (!ASSIGNABLE.some((s) => s === order.status)) message = 'Only confirmed orders not yet delivered can be given to a courier.';
  else if (courierId) {
    const courier = await prisma.courier.findUnique({ where: { id: courierId } });
    if (!courier || !courier.isActive) message = 'That courier is switched off or no longer exists.';
    else if (courier.cityId !== order.cityId) message = 'That courier works in another city.';
  }
  if (message) redirect(`/admin/orders/${order.id}?error=${encodeURIComponent(message)}`);

  await prisma.order.update({ where: { id: order.id }, data: { courierId: courierId || null } });
  refresh();
}
