import { connection, type NextRequest } from 'next/server';
import { shopperPlace } from '@/lib/cities';
import { listProducts, rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/products?market=CD&city=kinshasa&category=electromenager&q=frigo&take=40 */
export async function GET(request: NextRequest) {
  await connection();
  const sp = request.nextUrl.searchParams;
  const categorySlug = sp.get('category')?.trim().slice(0, 80) || undefined;
  const q = sp.get('q')?.trim().slice(0, 80) || undefined;
  const take = Number(sp.get('take')) || 40;
  try {
    const place = await shopperPlace(sp.get('market'), sp.get('city'), SHOPPER_HEADERS);
    if (place instanceof Response) return place;
    const { market, city } = place;
    const [rate, products] = await Promise.all([rateNumber(), listProducts({ cityId: city.id, categorySlug, q, take })]);
    return Response.json({ currency: market.currency, city: city.id, rate, products }, { headers: SHOPPER_HEADERS });
  } catch (e) {
    console.error('catalog/products failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
