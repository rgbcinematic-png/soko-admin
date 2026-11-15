import { connection, type NextRequest } from 'next/server';
import { shopperPlace } from '@/lib/cities';
import { getProductBySlug, rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/products/televiseur-led-smart-43?market=CD&city=kinshasa */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  try {
    const sp = request.nextUrl.searchParams;
    const place = await shopperPlace(sp.get('market'), sp.get('city'), SHOPPER_HEADERS);
    if (place instanceof Response) return place;
    const { market, city } = place;
    const [rate, product] = await Promise.all([rateNumber(), getProductBySlug(slug.slice(0, 120), city.id)]);
    if (!product) {
      return Response.json({ error: 'Not found' }, { status: 404, headers: SHOPPER_HEADERS });
    }
    return Response.json({ currency: market.currency, city: city.id, rate, product }, { headers: SHOPPER_HEADERS });
  } catch (e) {
    console.error('catalog/product failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
