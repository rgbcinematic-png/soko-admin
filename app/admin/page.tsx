import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <Link href="/admin/products/new" className="flex h-11 items-center rounded-xl bg-[#FF7A1A] px-5 font-bold text-[#0A2540]">
          + Add a product
        </Link>
      </div>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading figures…</p>}>
        <Figures />
      </Suspense>
    </div>
  );
}

async function Figures() {
  await connection();
  const onSale = { isActive: true, product: { status: 'ACTIVE' as const } };
  const [newOrders, active, drafts, outOfStock, lowStock] = await Promise.all([
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.count({ where: { status: 'DRAFT' } }),
    prisma.productVariant.count({ where: { ...onSale, stock: { lte: 0 } } }),
    prisma.productVariant.count({ where: { ...onSale, stock: { gt: 0, lte: 3 } } }),
  ]);

  const tiles = [
    { label: 'New orders to confirm', value: newOrders, href: '/admin/orders?show=new', alert: newOrders > 0 },
    { label: 'Products on sale', value: active, href: '/admin/products?status=ACTIVE' },
    { label: 'Drafts', value: drafts, href: '/admin/products?status=DRAFT' },
    { label: 'Variants out of stock', value: outOfStock, href: '/admin/products?status=ACTIVE', alert: outOfStock > 0 },
    { label: 'Low stock (3 or fewer)', value: lowStock, href: '/admin/products?status=ACTIVE' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href} className="flex flex-col gap-1 rounded-2xl bg-white p-5 hover:shadow-sm">
          <span className={`text-3xl font-extrabold ${t.alert ? 'text-[#BE123C]' : ''}`}>{t.value}</span>
          <span className="text-sm text-[#5B6B7C]">{t.label}</span>
        </Link>
      ))}
    </div>
  );
}
