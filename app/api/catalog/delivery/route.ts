import { connection, type NextRequest } from 'next/server';
import { marketClosedResponse, publicMarket, shopperMarket } from '@/lib/markets';
import { prisma } from '@/lib/prisma';
import { TIME_SLOTS } from '@/lib/delivery-fees';
import { getDeliverySettings } from '@/lib/delivery-settings';
import { rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/delivery?market=CD — the delivery and payment choices the checkout screen offers. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const market = await shopperMarket(request.nextUrl.searchParams.get('market'));
    if (!market) return marketClosedResponse(SHOPPER_HEADERS);
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
        currency: market.currency,
        rate,
        // Only the payment methods switched on for this market and connected to a provider.
        paymentMethods: publicMarket(market).paymentMethods,
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
