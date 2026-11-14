import { connection, type NextRequest } from 'next/server';
import { marketClosedResponse, shopperMarket } from '@/lib/markets';
import { listCategories, listProducts, rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/home?market=CD — everything the app's home screen needs in one call. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const market = await shopperMarket(request.nextUrl.searchParams.get('market'));
    if (!market) return marketClosedResponse(SHOPPER_HEADERS);
    const [rate, categories, featured, newest] = await Promise.all([
      rateNumber(),
      listCategories(),
      listProducts({ featured: true, take: 10 }),
      listProducts({ take: 20 }),
    ]);
    return Response.json({ currency: market.currency, rate, categories, featured, newest }, { headers: SHOPPER_HEADERS });
  } catch (e) {
    console.error('catalog/home failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
