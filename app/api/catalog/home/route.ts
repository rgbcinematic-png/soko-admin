import { connection, type NextRequest } from 'next/server';
import { shopperPlace } from '@/lib/cities';
import { listCategories, listProducts, rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/home?market=CD&city=kinshasa — everything the app's home screen needs in one call. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const sp = request.nextUrl.searchParams;
    const place = await shopperPlace(sp.get('market'), sp.get('city'), SHOPPER_HEADERS);
    if (place instanceof Response) return place;
    const { market, city } = place;
    const [rate, categories, featured, newest] = await Promise.all([
      rateNumber(),
      listCategories(),
      listProducts({ cityId: city.id, featured: true, take: 10 }),
      listProducts({ cityId: city.id, take: 20 }),
    ]);
    return Response.json(
      { currency: market.currency, city: city.id, rate, categories, featured, newest },
      { headers: SHOPPER_HEADERS },
    );
  } catch (e) {
    console.error('catalog/home failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
