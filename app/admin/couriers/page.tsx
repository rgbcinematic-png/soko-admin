import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pickCity } from '@/lib/cities';
import { VEHICLE_LABEL } from '@/lib/orders';
import CourierForm from '@/components/admin/CourierForm';
import { toggleCourier } from './actions';

type Search = Promise<{ city?: string }>;

export default function CouriersPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Couriers</h1>
        <p className="text-sm text-[#5B6B7C]">
          The people who deliver, in each city. An order can only be given to a courier of its own city.
        </p>
      </div>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading…</p>}>
        <CityCouriers searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CityCouriers({ searchParams }: { searchParams: Search }) {
  await connection();
  const { cities, city } = await pickCity((await searchParams).city);
  if (!city) return <p className="rounded-2xl bg-white p-6 font-bold">No cities yet.</p>;
  return (
    <>
      <nav aria-label="Cities" className="flex flex-wrap gap-2">
        {cities.map((c) => (
          <Link
            key={c.id}
            href={`/admin/couriers?city=${c.id}`}
            aria-current={c.id === city.id ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold ${c.id === city.id ? 'bg-[#0A2540] text-white' : 'bg-white'}`}
          >
            {c.name}
            {!c.isActive && <span className="font-medium opacity-70"> · closed</span>}
          </Link>
        ))}
      </nav>

      {/* The key empties the form when switching city. */}
      <CourierForm key={city.id} cityId={city.id} cityName={city.name} />

      <CourierList cityId={city.id} cityName={city.name} />
    </>
  );
}

async function CourierList({ cityId, cityName }: { cityId: string; cityName: string }) {
  const couriers = await prisma.courier.findMany({
    where: { cityId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { orders: { where: { status: { in: ['CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY'] } } } } } },
  });
  if (couriers.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-center font-bold">No couriers in {cityName} yet. Add the first one above.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-[#E3E7EC] text-xs uppercase tracking-wide text-[#5B6B7C]">
          <tr><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Vehicle</th><th className="p-3">Orders in hand</th><th className="p-3">Status</th></tr>
        </thead>
        <tbody>
          {couriers.map((c) => (
            <tr key={c.id} className="border-b border-[#F0F2F5] last:border-0">
              <td className="p-3 font-bold">{c.name}</td>
              <td className="p-3"><a href={`tel:${c.phone}`} className="font-bold text-[#B33A00] underline">{c.phone}</a></td>
              <td className="p-3">{VEHICLE_LABEL[c.vehicle]}</td>
              <td className="p-3">{c._count.orders}</td>
              <td className="p-3">
                <form action={toggleCourier}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={`rounded-md px-2 py-1 text-xs font-bold ${c.isActive ? 'bg-[#E7F6EC] text-[#15803D]' : 'bg-[#EEF1F4] text-[#5B6B7C]'}`}>
                    {c.isActive ? 'Working — switch off' : 'Off — switch on'}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
