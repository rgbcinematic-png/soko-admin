import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { getCategoryOptions } from '@/lib/catalog';
import { getCurrentRate } from '@/lib/rate';
import { toNumber } from '@/lib/money';
import ProductForm from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/products" className="text-sm font-bold text-[#5B6B7C]">← Products</Link>
        <h1 className="mt-1 text-2xl font-extrabold">Add a product</h1>
      </div>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading the form…</p>}>
        <NewProduct />
      </Suspense>
    </div>
  );
}

async function NewProduct() {
  await connection();
  const [categories, rate] = await Promise.all([getCategoryOptions(), getCurrentRate()]);
  if (categories.length === 0) {
    return <p className="rounded-2xl bg-white p-6">There are no categories yet. Run <code>node prisma/seed.ts</code> first.</p>;
  }
  return <ProductForm categories={categories} rate={toNumber(rate?.cdfPerUsd)} />;
}
