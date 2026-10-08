import Link from 'next/link';
import { Suspense } from 'react';
import type { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCategoryOptions } from '@/lib/catalog';
import { getCurrentRate } from '@/lib/rate';
import { cdf, toNumber, usd } from '@/lib/money';

type Filters = Promise<{ category?: string; status?: string; q?: string }>;

const STATUS_STYLE: Record<ProductStatus, string> = {
  ACTIVE: 'bg-[#E7F6EC] text-[#15803D]',
  DRAFT: 'bg-[#FFF3C4] text-[#7A5A00]',
  ARCHIVED: 'bg-[#EEF1F4] text-[#5B6B7C]',
};
const STATUS_LABEL: Record<ProductStatus, string> = { ACTIVE: 'Active', DRAFT: 'Draft', ARCHIVED: 'Archived' };

export default function ProductsPage({ searchParams }: { searchParams: Filters }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Products</h1>
        <Link href="/admin/products/new" className="flex h-11 items-center rounded-xl bg-[#FF7A1A] px-5 font-bold text-[#0A2540]">
          + Add a product
        </Link>
      </div>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading products…</p>}>
        <ProductList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProductList({ searchParams }: { searchParams: Filters }) {
  const sp = await searchParams;
  const status = (['DRAFT', 'ACTIVE', 'ARCHIVED'] as const).find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const category = sp.category || undefined;

  const where: Prisma.ProductWhereInput = {
    AND: [
      status ? { status } : {},
      category ? { OR: [{ categoryId: category }, { category: { parentId: category } }] } : {},
      q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { ref: { contains: q, mode: 'insensitive' } },
              { brand: { contains: q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {},
    ],
  };

  const [categories, rate, products] = await Promise.all([
    getCategoryOptions(),
    getCurrentRate(),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        category: { select: { nameFr: true } },
        variants: { where: { isActive: true }, select: { priceUsd: true, stock: true } },
      },
    }),
  ]);

  const field = 'h-10 rounded-lg border border-[#C9D1DA] bg-white px-2 text-sm outline-none focus:border-[#0A2540]';

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium text-[#5B6B7C]">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Title, ref, brand or SKU" className={`${field} w-56`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="category" className="text-xs font-medium text-[#5B6B7C]">Category</label>
          <select id="category" name="category" defaultValue={category ?? ''} className={field}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs font-medium text-[#5B6B7C]">Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className={field}>
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <button type="submit" className="h-10 rounded-lg bg-[#0A2540] px-4 text-sm font-bold text-white">Filter</button>
        <Link href="/admin/products" className="flex h-10 items-center px-2 text-sm font-bold">Clear</Link>
      </form>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center">
          <p className="font-bold">No products {q || status || category ? 'match these filters' : 'yet'}.</p>
          <Link href="/admin/products/new" className="mt-2 inline-block font-bold text-[#B33A00]">Add your first product</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#E3E7EC] text-xs uppercase tracking-wide text-[#5B6B7C]">
              <tr>
                <th className="p-3">Photo</th>
                <th className="p-3">Product</th>
                <th className="p-3">Category</th>
                <th className="p-3">Price</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const prices = p.variants.map((v) => toNumber(v.priceUsd) ?? 0);
                const low = prices.length ? Math.min(...prices) : null;
                const high = prices.length ? Math.max(...prices) : null;
                const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
                return (
                  <tr key={p.id} className="border-b border-[#F0F2F5] last:border-0">
                    <td className="p-3">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-[#F4F5F7]" aria-hidden="true" />
                      )}
                    </td>
                    <td className="p-3">
                      <Link href={`/admin/products/${p.id}`} className="font-bold hover:underline">{p.title}</Link>
                      <div className="text-xs text-[#5B6B7C]">{p.ref}</div>
                    </td>
                    <td className="p-3">{p.category.nameFr}</td>
                    <td className="p-3">
                      {low === null ? '—' : low === high ? usd(low) : `${usd(low)} – ${usd(high)}`}
                      {low !== null && rate && <div className="text-xs text-[#5B6B7C]">≈ {cdf(low, rate.cdfPerUsd)}</div>}
                    </td>
                    <td className={`p-3 font-bold ${stock <= 0 ? 'text-[#BE123C]' : ''}`}>{stock}</td>
                    <td className="p-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
