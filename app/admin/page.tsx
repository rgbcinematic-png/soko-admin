import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentRate } from '@/lib/rate';
import { cdf, toNumber, usd, type Decimalish } from '@/lib/money';
import { STATUS_LABEL, STATUS_STYLE } from '@/lib/orders';

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

// Kinshasa is UTC+1 all year (no summer time).
const KINSHASA_OFFSET_MS = 60 * 60 * 1000;

/** Start of today, of this week (Monday) and of this month, in Kinshasa time. */
function kinshasaPeriods(now = new Date()) {
  const local = new Date(now.getTime() + KINSHASA_OFFSET_MS);
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const toUtc = (t: number) => new Date(t - KINSHASA_OFFSET_MS);
  return {
    today: toUtc(dayStart),
    week: toUtc(dayStart - daysSinceMonday * 24 * 60 * 60 * 1000),
    month: toUtc(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)),
  };
}

const IN_PROGRESS: OrderStatus[] = ['CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP'];

async function Figures() {
  await connection();
  const { today, week, month } = kinshasaPeriods();
  const onSale = { isActive: true, product: { status: 'ACTIVE' as const } };
  const delivered = (since: Date) =>
    prisma.order.aggregate({ where: { status: 'DELIVERED', deliveredAt: { gte: since } }, _sum: { totalUsd: true }, _count: true });

  const [rate, placedToday, salesWeek, salesMonth, newOrders, inProgress, active, drafts, outOfStock, lowStock, toReorder, latest] =
    await Promise.all([
      getCurrentRate(),
      prisma.order.aggregate({
        where: { createdAt: { gte: today }, status: { not: 'CANCELLED' } },
        _sum: { totalUsd: true },
        _count: true,
      }),
      delivered(week),
      delivered(month),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: { in: IN_PROGRESS } } }),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'DRAFT' } }),
      prisma.productVariant.count({ where: { ...onSale, stock: { lte: 0 } } }),
      prisma.productVariant.count({ where: { ...onSale, stock: { gt: 0, lte: 3 } } }),
      prisma.productVariant.findMany({
        where: { ...onSale, stock: { lte: 3 } },
        orderBy: [{ stock: 'asc' }, { product: { title: 'asc' } }],
        take: 8,
        select: { id: true, label: true, stock: true, product: { select: { id: true, title: true } } },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, ref: true, status: true, totalUsd: true, createdAt: true, customer: { select: { name: true } } },
      }),
    ]);
  const cdfRate = rate?.cdfPerUsd ?? null;
  const money = (v: Decimalish) => usd(toNumber(v) ?? 0);
  const francs = (v: Decimalish) => (cdfRate ? `≈ ${cdf(toNumber(v) ?? 0, cdfRate)}` : '');
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const money3 = [
    { label: 'Placed today', value: money(placedToday._sum.totalUsd), fc: francs(placedToday._sum.totalUsd), note: plural(placedToday._count, 'order') },
    { label: 'Delivered this week', value: money(salesWeek._sum.totalUsd), fc: francs(salesWeek._sum.totalUsd), note: plural(salesWeek._count, 'order') },
    { label: 'Delivered this month', value: money(salesMonth._sum.totalUsd), fc: francs(salesMonth._sum.totalUsd), note: plural(salesMonth._count, 'order') },
  ];

  const tiles = [
    { label: 'New orders to confirm', value: newOrders, href: '/admin/orders?show=new', alert: newOrders > 0 },
    { label: 'Orders in progress', value: inProgress, href: '/admin/orders' },
    { label: 'Products on sale', value: active, href: '/admin/products?status=ACTIVE' },
    { label: 'Drafts', value: drafts, href: '/admin/products?status=DRAFT' },
    { label: 'Variants out of stock', value: outOfStock, href: '/admin/products?status=ACTIVE', alert: outOfStock > 0 },
    { label: 'Low stock (3 or fewer)', value: lowStock, href: '/admin/products?status=ACTIVE' },
  ];

  const card = 'rounded-2xl bg-white p-5';
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Sales" className="grid gap-4 md:grid-cols-3">
        {money3.map((m) => (
          <div key={m.label} className={`${card} flex flex-col gap-1`}>
            <span className="text-sm font-medium text-[#5B6B7C]">{m.label}</span>
            <span className="text-3xl font-extrabold">{m.value}</span>
            <span className="text-sm text-[#5B6B7C]">{[m.note, m.fc].filter(Boolean).join(' · ')}</span>
          </div>
        ))}
      </section>

      <section aria-label="To do" className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`${card} flex flex-col gap-1 hover:shadow-sm`}>
            <span className={`text-3xl font-extrabold ${t.alert ? 'text-[#BE123C]' : ''}`}>{t.value}</span>
            <span className="text-sm text-[#5B6B7C]">{t.label}</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="text-lg font-extrabold">Latest orders</h2>
          {latest.length === 0 ? (
            <p className="text-sm text-[#5B6B7C]">No orders yet.</p>
          ) : (
            <ul className="flex flex-col">
              {latest.map((o) => (
                <li key={o.id} className="border-b border-[#F0F2F5] last:border-0">
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2 hover:underline">
                    <span>
                      <b>{o.ref}</b>
                      <span className="block text-xs text-[#5B6B7C]">
                        {o.customer.name} ·{' '}
                        {o.createdAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kinshasa' })}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                      <b>{usd(o.totalUsd)}</b>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <h2 className="text-lg font-extrabold">Stock to reorder</h2>
          {toReorder.length === 0 ? (
            <p className="text-sm text-[#5B6B7C]">Nothing low on stock.</p>
          ) : (
            <ul className="flex flex-col">
              {toReorder.map((v) => (
                <li key={v.id} className="border-b border-[#F0F2F5] last:border-0">
                  <Link href={`/admin/products/${v.product.id}`} className="flex items-center justify-between gap-3 py-2 hover:underline">
                    <span>
                      <b>{v.product.title}</b>
                      <span className="block text-xs text-[#5B6B7C]">{v.label}</span>
                    </span>
                    <span className={`rounded-md px-2 py-1 text-xs font-bold ${v.stock <= 0 ? 'bg-[#FDE8EC] text-[#BE123C]' : 'bg-[#FFF3C4] text-[#7A5A00]'}`}>
                      {v.stock <= 0 ? 'Out of stock' : `${v.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="text-xs text-[#5B6B7C]">Days and weeks follow Kinshasa time; weeks start on Monday. Cancelled orders are not counted.</p>
    </div>
  );
}
