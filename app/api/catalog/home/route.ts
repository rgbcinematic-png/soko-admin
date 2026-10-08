import { connection } from 'next/server';
import { listCategories, listProducts, rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

/** GET /api/catalog/home — everything the app's home screen needs in one call. */
export async function GET() {
  await connection();
  try {
    const [rate, categories, featured, newest] = await Promise.all([
      rateNumber(),
      listCategories(),
      listProducts({ featured: true, take: 10 }),
      listProducts({ take: 20 }),
    ]);
    return Response.json({ rate, categories, featured, newest }, { headers: SHOPPER_HEADERS });
  } catch (e) {
    console.error('catalog/home failed', e);
    return Response.json({ error: 'Unavailable' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
