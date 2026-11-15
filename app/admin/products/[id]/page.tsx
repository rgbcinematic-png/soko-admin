import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCategoryOptions } from '@/lib/catalog';
import { getCurrentRate } from '@/lib/rate';
import { toNumber } from '@/lib/money';
import { allCities } from '@/lib/cities';
import ProductForm, { type ProductInitial } from '@/components/admin/ProductForm';
import StockAdjust from '@/components/admin/StockAdjust';

type Params = Promise<{ id: string }>;
type Search = Promise<{ saved?: string }>;

const REASON: Record<string, string> = {
  PURCHASE: 'New stock',
  SALE: 'Sold',
  RETURN: 'Returned',
  ADJUSTMENT: 'Counted and corrected',
};

export default function EditProductPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/products" className="text-sm font-bold text-[#5B6B7C]">← Products</Link>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading the product…</p>}>
        <EditProduct params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditProduct({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, categories, rate, movements, cities] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { position: 'asc' }, include: { offers: true } }, cities: true },
    }),
    getCategoryOptions(),
    getCurrentRate(),
    prisma.stockMovement.findMany({
      where: { variant: { productId: id } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { variant: { select: { label: true } }, by: { select: { name: true } }, city: { select: { name: true } } },
    }),
    allCities(),
  ]);
  if (!product) notFound();

  const specs = Array.isArray(product.specs) ? (product.specs as { label?: string; value?: string }[]) : [];
  const initial: ProductInitial = {
    id: product.id,
    title: product.title,
    categoryId: product.categoryId,
    brand: product.brand ?? '',
    summary: product.summary ?? '',
    description: product.description ?? '',
    status: product.status,
    featured: product.featured,
    warrantyMonths: product.warrantyMonths,
    installAvailable: product.installAvailable,
    installByCity: Object.fromEntries(product.cities.map((c) => [c.cityId, c.installPriceUsd?.toString() ?? ''])),
    instalmentsAllowed: product.instalmentsAllowed,
    bigItem: product.bigItem,
    images: product.images,
    specsText: specs.map((s) => `${s.label ?? ''} | ${s.value ?? ''}`).join('\n'),
    variants: product.variants.map((v) => ({
      key: v.id,
      id: v.id,
      label: v.label,
      sku: v.sku,
      isActive: v.isActive,
      cities: Object.fromEntries(
        v.offers.map((o) => [
          o.cityId,
          {
            priceUsd: o.priceUsd?.toString() ?? '',
            compareAtUsd: o.compareAtUsd?.toString() ?? '',
            costUsd: o.costUsd?.toString() ?? '',
            openingStock: '',
          },
        ]),
      ),
    })),
  };
  const stockByVariant = Object.fromEntries(
    product.variants.map((v) => [v.id, Object.fromEntries(v.offers.map((o) => [o.cityId, o.stock]))]),
  );
  const cityColumns = cities.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive }));
  const when = (d: Date) =>
    d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kinshasa' });

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">{product.title}</h1>
        <p className="text-sm text-[#5B6B7C]">{product.ref} · updated {when(product.updatedAt)} (Kinshasa time)</p>
      </div>

      {sp.saved && (
        <p role="status" className="rounded-xl bg-[#E7F6EC] p-3 font-bold text-[#15803D]">
          {sp.saved === 'created' ? 'Product created. You can keep editing below.' : 'Changes saved.'}
        </p>
      )}

      {/* The key makes the form start fresh after each save, so new variants pick up their saved ids. */}
      <ProductForm
        key={product.updatedAt.toISOString()}
        categories={categories}
        rate={toNumber(rate?.cdfPerUsd)}
        cities={cityColumns}
        initial={initial}
        stockByVariant={stockByVariant}
      />

      <section id="stock" className="flex flex-col gap-4 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-extrabold">Stock</h2>
        <p className="text-sm text-[#5B6B7C]">Each city has its own stock. Orders take stock from the city they are delivered in.</p>
        {product.variants.map((v) => (
          <div key={v.id} className="flex flex-col gap-3 border-b border-[#F0F2F5] pb-4 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-bold">{v.label}</span>
              <span className="text-xs text-[#5B6B7C]">{v.sku}</span>
              {!v.isActive && <span className="text-xs font-bold text-[#5B6B7C]">switched off</span>}
            </div>
            {cities.map((c) => {
              const offer = v.offers.find((o) => o.cityId === c.id);
              const stock = offer?.stock ?? 0;
              return (
                <div key={c.id} className="flex flex-col gap-1 pl-3">
                  <div className="flex flex-wrap items-baseline gap-3 text-sm">
                    <span className="w-28 font-bold">{c.name}</span>
                    <span className={`font-bold ${stock <= 0 ? 'text-[#BE123C]' : ''}`}>{stock} in stock</span>
                    {!offer?.priceUsd && <span className="text-xs text-[#5B6B7C]">no price: not sold here</span>}
                  </div>
                  <StockAdjust variantId={v.id} cityId={c.id} />
                </div>
              );
            })}
          </div>
        ))}

        <h3 className="mt-2 font-bold">Recent stock changes</h3>
        {movements.length === 0 ? (
          <p className="text-sm text-[#5B6B7C]">No stock changes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#5B6B7C]">
                <tr>
                  <th className="py-2 pr-3">When (Kinshasa)</th>
                  <th className="py-2 pr-3">City</th>
                  <th className="py-2 pr-3">Variant</th>
                  <th className="py-2 pr-3">Change</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3">By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-[#F0F2F5]">
                    <td className="py-2 pr-3">{when(m.createdAt)}</td>
                    <td className="py-2 pr-3">{m.city.name}</td>
                    <td className="py-2 pr-3">{m.variant.label}</td>
                    <td className={`py-2 pr-3 font-bold ${m.change < 0 ? 'text-[#BE123C]' : 'text-[#15803D]'}`}>
                      {m.change > 0 ? `+${m.change}` : m.change}
                    </td>
                    <td className="py-2 pr-3">{REASON[m.reason] ?? m.reason}</td>
                    <td className="py-2 pr-3">{m.note ?? ''}</td>
                    <td className="py-2 pr-3">{m.by?.name ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
