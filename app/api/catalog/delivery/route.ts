import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TIME_SLOTS } from '@/lib/delivery-fees';
import { getDeliverySettings } from '@/lib/delivery-settings';
import { rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/delivery — the choices the checkout screen offers. */
export async function GET() {
  await connection();
  try {
    const [rate, settings, pickupPoints] = await Promise.all([
      rateNumber(),
      getDeliverySettings(),
      prisma.pickupPoint.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, commune: true, landmark: true, openingHours: true },
      }),
    ]);
    const served = settings.communes.filter((c) => c.isServed);
    return Response.json(
      {
        rate,
        // Only the delivery types switched on in the admin.
        methods: settings.methods.filter((m) => m.isActive),
        // Only the communes Soko delivers to; extra charge per commune (0 = none).
        communes: served.map((c) => c.name),
        communeSurcharges: Object.fromEntries(served.map((c) => [c.name, c.surchargeUsd])),
        timeSlots: TIME_SLOTS,
        pickupPoints,
      },
      { headers: SHOPPER_HEADERS },
    );
  } catch (e) {
    console.error('catalog/delivery failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
