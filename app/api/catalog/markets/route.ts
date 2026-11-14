import { connection } from 'next/server';
import { listShopperMarkets } from '@/lib/markets';
import { SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/markets — the regions the app can sell in, with their currency and payment methods. */
export async function GET() {
  await connection();
  try {
    return Response.json({ markets: await listShopperMarkets() }, { headers: SHOPPER_HEADERS });
  } catch (e) {
    console.error('catalog/markets failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
