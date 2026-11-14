import { connection, type NextRequest } from 'next/server';
import { marketClosedResponse, shopperMarket } from '@/lib/markets';
import { getProductBySlug, rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/products/televiseur-led-smart-43?market=CD */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  try {
    const market = await shopperMarket(request.nextUrl.searchParams.get('market'));
    if (!market) return marketClosedResponse(SHOPPER_HEADERS);
    const [rate, product] = await Promise.all([rateNumber(), getProductBySlug(slug.slice(0, 120))]);
    if (!product) {
      return Response.json({ error: 'Not found' }, { status: 404, headers: SHOPPER_HEADERS });
    }
    return Response.json({ currency: market.currency, rate, product }, { headers: SHOPPER_HEADERS });
  } catch (e) {
    console.error('catalog/product failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
