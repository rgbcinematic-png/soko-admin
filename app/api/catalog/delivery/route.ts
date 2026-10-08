import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DELIVERY_METHODS, KINSHASA_COMMUNES, TIME_SLOTS } from '@/lib/delivery-fees';
import { rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/delivery — the choices the checkout screen offers. */
export async function GET() {
  await connection();
  try {
    const [rate, pickupPoints] = await Promise.all([
      rateNumber(),
      prisma.pickupPoint.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, commune: true, landmark: true, openingHours: true },
      }),
    ]);
    return Response.json(
      { rate, methods: DELIVERY_METHODS, communes: KINSHASA_COMMUNES, timeSlots: TIME_SLOTS, pickupPoints },
      { headers: SHOPPER_HEADERS },
    );
  } catch (e) {
    console.error('catalog/delivery failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
