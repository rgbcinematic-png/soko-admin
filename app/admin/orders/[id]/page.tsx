import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { cdf, usd } from '@/lib/money';
import { METHOD_LABEL, nextSteps, STATUS_LABEL, STATUS_STYLE } from '@/lib/orders';
import { moveOrder, saveOrderNote } from '../actions';

type Params = Promise<{ id: string }>;
type Search = Promise<{ error?: string }>;

const BUTTON: Record<string, string> = {
  CONFIRMED: 'Confirm order (takes stock)',
  PACKED: 'Mark packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  READY_FOR_PICKUP: 'Ready at pickup point',
  DELIVERED: 'Delivered and paid',
  CANCELLED: 'Cancel order',
  RETURNED: 'Returned',
};

export default function OrderPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/orders" className="text-sm font-bold text-[#5B6B7C]">← Orders</Link>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading the order…</p>}>
        <OrderDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrderDetail({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      pickupPoint: true,
      items: true,
      events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!order) notFound();

  const addr = (order.addressSnapshot ?? {}) as {
    commune?: string; quartier?: string | null; avenue?: string | null; landmark?: string; instructions?: string | null;
  };
  const steps = nextSteps(order.status, order.deliveryMethod);
  const when = (d: Date) =>
    d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kinshasa' });
  const waNumber = order.customer.phone.replace(/\D/g, '');
  const card = 'flex flex-col gap-2 rounded-2xl bg-white p-5';

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">{order.ref}</h1>
        <span className={`rounded-md px-2 py-1 text-xs font-bold ${STATUS_STYLE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
        <span className="text-sm text-[#5B6B7C]">placed {when(order.createdAt)} (Kinshasa)</span>
      </div>

      {sp.error && (
        <p role="alert" className="rounded-xl bg-[#FDE8EC] p-3 font-bold text-[#BE123C]">{sp.error}</p>
      )}

      {steps.length > 0 && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Next step</h2>
          {order.status === 'PENDING' && (
            <p className="text-sm text-[#5B6B7C]">Call the customer to confirm the order and the delivery place before confirming.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {steps.map((to) => (
              <form key={to} action={moveOrder}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="to" value={to} />
                <button
                  type="submit"
                  className={`h-11 rounded-xl px-4 font-bold ${
                    to === 'CANCELLED' || to === 'RETURNED'
                      ? 'border border-[#BE123C] text-[#BE123C]'
                      : 'bg-[#FF7A1A] text-[#0A2540]'
                  }`}
                >
                  {BUTTON[to]}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <section className={card}>
          <h2 className="text-lg font-extrabold">Customer</h2>
          <p className="font-bold">{order.customer.name}</p>
          <div className="flex flex-wrap gap-3 text-sm font-bold">
            <a href={`tel:${order.customer.phone}`} className="text-[#B33A00] underline">{order.customer.phone}</a>
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="text-[#15803D] underline">WhatsApp</a>
          </div>
          {order.recipientName || order.recipientPhone ? (
            <p className="text-sm">Deliver to: <b>{order.recipientName}</b> {order.recipientPhone}</p>
          ) : null}
          {order.customerNote && <p className="rounded-lg bg-[#F4F5F7] p-3 text-sm">“{order.customerNote}”</p>}
        </section>

        <section className={card}>
          <h2 className="text-lg font-extrabold">Delivery · {METHOD_LABEL[order.deliveryMethod]}</h2>
          {order.pickupPoint ? (
            <p className="text-sm">
              <b>{order.pickupPoint.name}</b>, {order.pickupPoint.commune}<br />{order.pickupPoint.landmark}
            </p>
          ) : (
            <p className="text-sm">
              <b>{addr.commune}</b>
              {addr.quartier ? `, ${addr.quartier}` : ''}
              {addr.avenue ? `, ${addr.avenue}` : ''}
              <br />Landmark: <b>{addr.landmark}</b>
              {addr.instructions ? <><br />Note: {addr.instructions}</> : null}
            </p>
          )}
          {order.timeSlot && <p className="text-sm">Time slot: <b>{order.timeSlot}</b></p>}
          <p className="text-sm">
            Delivery code: <b className="tracking-widest">{order.deliveryCode}</b>
            <span className="text-[#5B6B7C]"> — the customer gives this to the courier at the door.</span>
          </p>
        </section>
      </div>

      <section className={card}>
        <h2 className="text-lg font-extrabold">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#5B6B7C]">
              <tr><th className="py-2 pr-3">Product</th><th className="py-2 pr-3">Qty</th><th className="py-2 pr-3">Unit</th><th className="py-2 pr-3">Line</th></tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-t border-[#F0F2F5]">
                  <td className="py-2 pr-3">
                    <b>{it.title}</b> · {it.variantLabel}
                    {it.withInstall && <span className="ml-2 rounded bg-[#E7F6EC] px-1.5 py-0.5 text-xs font-bold text-[#15803D]">+ installation</span>}
                  </td>
                  <td className="py-2 pr-3">{it.quantity}</td>
                  <td className="py-2 pr-3">{usd(it.unitPriceUsd)}</td>
                  <td className="py-2 pr-3 font-bold">{usd(it.lineTotalUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
          <dt className="text-[#5B6B7C]">Items</dt><dd className="text-right">{usd(order.subtotalUsd)}</dd>
          <dt className="text-[#5B6B7C]">Delivery</dt><dd className="text-right">{usd(order.deliveryUsd)}</dd>
          {Number(order.installUsd) > 0 && (<><dt className="text-[#5B6B7C]">Installation</dt><dd className="text-right">{usd(order.installUsd)}</dd></>)}
          <dt className="font-bold">Total</dt><dd className="text-right text-lg font-extrabold">{usd(order.totalUsd)}</dd>
          <dt className="text-[#5B6B7C]">In francs</dt><dd className="text-right">{cdf(order.totalUsd, order.cdfPerUsd)}</dd>
          <dt className="text-[#5B6B7C]">Payment</dt><dd className="text-right">Cash on delivery · {order.paymentStatus === 'PAID' ? 'paid' : order.paymentStatus.toLowerCase()}</dd>
        </dl>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className={card}>
          <h2 className="text-lg font-extrabold">History</h2>
          <ol className="flex flex-col gap-2 text-sm">
            {order.events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-2">
                <span className="text-[#5B6B7C]">{when(e.createdAt)}</span>
                <b>{STATUS_LABEL[e.status]}</b>
                {e.actor?.name && <span className="text-[#5B6B7C]">by {e.actor.name}</span>}
                {e.note && <span>— {e.note}</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className={card}>
          <h2 className="text-lg font-extrabold">Private note</h2>
          <form action={saveOrderNote} className="flex flex-col gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <label htmlFor="internalNote" className="text-sm text-[#5B6B7C]">Only staff see this.</label>
            <textarea id="internalNote" name="internalNote" rows={4} defaultValue={order.internalNote ?? ''} className="rounded-lg border border-[#C9D1DA] p-2 outline-none focus:border-[#0A2540]" />
            <button type="submit" className="h-10 self-start rounded-lg bg-[#0A2540] px-4 text-sm font-bold text-white">Save note</button>
          </form>
        </section>
      </div>
    </>
  );
}
