import { connection, type NextRequest } from 'next/server';
import { publicMarket } from '@/lib/markets';
import { shopperPlace } from '@/lib/cities';
import { prisma } from '@/lib/prisma';
import { TIME_SLOTS } from '@/lib/delivery-fees';
import { getDeliverySettings } from '@/lib/delivery-settings';
import { rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/delivery?market=CD&city=kinshasa — the delivery and payment choices the checkout screen offers. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const sp = request.nextUrl.searchParams;
    const place = await shopperPlace(sp.get('market'), sp.get('city'), SHOPPER_HEADERS);
    if (place instanceof Response) return place;
    const { market, city } = place;
    const [rate, settings, pickupPoints] = await Promise.all([
      rateNumber(),
      getDeliverySettings(city.id),
      prisma.pickupPoint.findMany({
        where: { cityId: city.id, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, commune: true, landmark: true, openingHours: true },
      }),
    ]);
    const served = settings.communes.filter((c) => c.isServed);
    return Response.json(
      {
        currency: market.currency,
        city: city.id,
        rate,
        // Only the payment methods switched on for this market and connected to a provider.
        paymentMethods: publicMarket(market).paymentMethods,
        // Only the delivery types switched on in the admin.
        methods: settings.methods
          .filter((m) => m.isActive)
          .map(({ id, label, detail, feeUsd, toHome, forBigItems, isActive }) => ({ id, label, detail, feeUsd, toHome, forBigItems, isActive })),
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
