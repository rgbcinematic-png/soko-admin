import { connection, type NextRequest } from 'next/server';
import { marketClosedResponse, shopperMarket } from '@/lib/markets';
import { listProducts, rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/products?market=CD&category=electromenager&q=frigo&take=40 */
export async function GET(request: NextRequest) {
  await connection();
  const sp = request.nextUrl.searchParams;
  const categorySlug = sp.get('category')?.trim().slice(0, 80) || undefined;
  const q = sp.get('q')?.trim().slice(0, 80) || undefined;
  const take = Number(sp.get('take')) || 40;
  try {
    const market = await shopperMarket(sp.get('market'));
    if (!market) return marketClosedResponse(SHOPPER_HEADERS);
    const [rate, products] = await Promise.all([rateNumber(), listProducts({ categorySlug, q, take })]);
    return Response.json({ currency: market.currency, rate, products }, { headers: SHOPPER_HEADERS });
  } catch (e) {
    console.error('catalog/products failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
