import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { cdf, usd } from '@/lib/money';
import { METHOD_LABEL, nextSteps, STATUS_LABEL, STATUS_STYLE, VEHICLE_LABEL } from '@/lib/orders';
import { PAYMENT_LABEL } from '@/lib/payments';
import { moveOrder, saveOrderNote } from '../actions';
import { assignCourier } from '../../couriers/actions';

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
      city: { select: { name: true } },
      pickupPoint: true,
      courier: true,
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
  // Home deliveries that are confirmed but not delivered yet can be given to a courier of the order's city.
  const courierStep = !order.pickupPointId && ['CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY'].includes(order.status);
  const couriers = courierStep
    ? await prisma.courier.findMany({ where: { cityId: order.cityId, isActive: true }, orderBy: { name: 'asc' } })
    : [];
  const bigItem = order.deliveryMethod === 'BIG_ITEM';
  // What the courier needs, sent on WhatsApp. Never the delivery code: the customer gives it at the door.
  const courierMessage = [
    `Soko ${order.ref} — ${order.city.name}`,
    `Client : ${order.recipientName || order.customer.name} ${order.recipientPhone || order.customer.phone}`,
    `Adresse : ${[addr.commune, addr.quartier, addr.avenue].filter(Boolean).join(', ')}`,
    `Repère : ${addr.landmark ?? ''}`,
    addr.instructions ? `Note : ${addr.instructions}` : null,
    order.timeSlot ? `Créneau : ${order.timeSlot}` : null,
    `Articles : ${order.items.map((i) => `${i.quantity} × ${i.title} (${i.variantLabel})`).join(', ')}`,
    order.paymentStatus === 'PAID' ? 'Déjà payé.' : `À encaisser : ${usd(order.totalUsd)}`,
  ].filter(Boolean).join('\n');
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
          <h2 className="text-lg font-extrabold">Delivery in {order.city.name} · {METHOD_LABEL[order.deliveryMethod]}</h2>
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

      {(courierStep || order.courier) && !order.pickupPointId && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Courier</h2>
          {order.courier ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <b>{order.courier.name}</b>
              <span className="text-[#5B6B7C]">{VEHICLE_LABEL[order.courier.vehicle]}</span>
              <a href={`tel:${order.courier.phone}`} className="font-bold text-[#B33A00] underline">{order.courier.phone}</a>
              <a
                href={`https://wa.me/${order.courier.phone.replace(/\D/g, '')}?text=${encodeURIComponent(courierMessage)}`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[#15803D] underline"
              >
                Send the delivery on WhatsApp
              </a>
            </div>
          ) : (
            <p className="text-sm text-[#5B6B7C]">No courier yet.</p>
          )}
          {courierStep && (
            couriers.length > 0 ? (
              // The key resets the choice to the saved courier after each save.
              <form key={order.courierId ?? 'none'} action={assignCourier} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <div className="flex flex-col gap-1">
                  <label htmlFor="courierId" className="text-xs font-medium text-[#5B6B7C]">
                    {order.courier ? 'Change courier' : 'Give to'} ({order.city.name} couriers{bigItem ? ', a van is needed' : ''})
                  </label>
                  <select id="courierId" name="courierId" defaultValue={order.courierId ?? ''} className="h-10 rounded-lg border border-[#C9D1DA] px-2 text-sm outline-none focus:border-[#0A2540]">
                    <option value="">No courier</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {VEHICLE_LABEL[c.vehicle]}{bigItem && c.vehicle !== 'VAN' ? ' (no van)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="h-10 rounded-lg bg-[#0A2540] px-4 text-sm font-bold text-white">Save</button>
              </form>
            ) : (
              <p className="text-sm">
                No working couriers in {order.city.name}.{' '}
                <Link href={`/admin/couriers?city=${order.cityId}`} className="font-bold underline">Add one</Link>
              </p>
            )
          )}
        </section>
      )}

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
          <dt className="text-[#5B6B7C]">Payment</dt><dd className="text-right">{PAYMENT_LABEL[order.paymentMethod]} · {order.paymentStatus.toLowerCase()}</dd>
          <dt className="text-[#5B6B7C]">Market</dt><dd className="text-right">{order.marketId} · {order.currency}</dd>
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
