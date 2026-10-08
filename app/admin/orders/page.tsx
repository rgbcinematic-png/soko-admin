import Link from 'next/link';
import { Suspense } from 'react';
import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { usd } from '@/lib/money';
import { METHOD_LABEL, STATUS_LABEL, STATUS_STYLE } from '@/lib/orders';

type Filters = Promise<{ show?: string }>;

const OPEN: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP'];
const VIEWS: { id: string; label: string; where: Prisma.OrderWhereInput }[] = [
  { id: 'open', label: 'To handle', where: { status: { in: OPEN } } },
  { id: 'new', label: 'New', where: { status: 'PENDING' } },
  { id: 'done', label: 'Delivered', where: { status: 'DELIVERED' } },
  { id: 'closed', label: 'Cancelled / returned', where: { status: { in: ['CANCELLED', 'RETURNED'] } } },
  { id: 'all', label: 'All', where: {} },
];

export default function OrdersPage({ searchParams }: { searchParams: Filters }) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Orders</h1>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading orders…</p>}>
        <OrderList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrderList({ searchParams }: { searchParams: Filters }) {
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.id === sp.show) ?? VIEWS[0];
  const orders = await prisma.order.findMany({
    where: view.where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      customer: { select: { name: true, phone: true } },
      pickupPoint: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  const when = (d: Date) =>
    d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kinshasa' });

  return (
    <>
      <nav aria-label="Order filters" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/admin/orders?show=${v.id}`}
            aria-current={v.id === view.id ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold ${v.id === view.id ? 'bg-[#0A2540] text-white' : 'bg-white'}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center font-bold">No orders here yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#E3E7EC] text-xs uppercase tracking-wide text-[#5B6B7C]">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Placed (Kinshasa)</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Delivery</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const addr = (o.addressSnapshot ?? {}) as { commune?: string };
                return (
                  <tr key={o.id} className="border-b border-[#F0F2F5] last:border-0">
                    <td className="p-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-bold hover:underline">{o.ref}</Link>
                      <div className="text-xs text-[#5B6B7C]">{o._count.items} line{o._count.items > 1 ? 's' : ''}</div>
                    </td>
                    <td className="p-3">{when(o.createdAt)}</td>
                    <td className="p-3">
                      {o.customer.name}
                      <div className="text-xs text-[#5B6B7C]">{o.customer.phone}</div>
                    </td>
                    <td className="p-3">
                      {METHOD_LABEL[o.deliveryMethod]}
                      <div className="text-xs text-[#5B6B7C]">{o.pickupPoint?.name ?? addr.commune ?? ''}</div>
                    </td>
                    <td className="p-3 font-bold">{usd(o.totalUsd)}</td>
                    <td className="p-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
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
