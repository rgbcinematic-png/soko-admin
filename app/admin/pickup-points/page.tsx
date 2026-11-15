import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pickCity } from '@/lib/cities';
import { addPickupPoint, togglePickupPoint } from './actions';

type Search = Promise<{ city?: string }>;

export default function PickupPointsPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Pickup points</h1>
        <p className="text-sm text-[#5B6B7C]">
          Partner shops where customers collect orders, in each city. Only active ones appear in the app.
        </p>
      </div>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading…</p>}>
        <CityPoints searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CityPoints({ searchParams }: { searchParams: Search }) {
  await connection();
  const { cities, city } = await pickCity((await searchParams).city);
  if (!city) return <p className="rounded-2xl bg-white p-6 font-bold">No cities yet.</p>;
  const communes = await prisma.communeSetting.findMany({ where: { cityId: city.id }, orderBy: { name: 'asc' }, select: { name: true } });
  const field = 'h-10 rounded-lg border border-[#C9D1DA] px-2 text-sm outline-none focus:border-[#0A2540]';
  const small = 'text-xs font-medium text-[#5B6B7C]';
  return (
    <>
      <nav aria-label="Cities" className="flex flex-wrap gap-2">
        {cities.map((c) => (
          <Link
            key={c.id}
            href={`/admin/pickup-points?city=${c.id}`}
            aria-current={c.id === city.id ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold ${c.id === city.id ? 'bg-[#0A2540] text-white' : 'bg-white'}`}
          >
            {c.name}
            {!c.isActive && <span className="font-medium opacity-70"> · closed</span>}
          </Link>
        ))}
      </nav>

      {/* The key empties the form when switching city. */}
      <form key={city.id} action={addPickupPoint} className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5">
        <input type="hidden" name="cityId" value={city.id} />
        <h2 className="w-full text-lg font-extrabold">Add a pickup point in {city.name}</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className={small}>Name</label>
          <input id="name" name="name" required minLength={2} maxLength={80} className={`${field} w-56`} placeholder="Soko Gombe" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="commune" className={small}>Commune</label>
          <select id="commune" name="commune" required defaultValue="" className={field}>
            <option value="" disabled>Choose…</option>
            {communes.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="landmark" className={small}>Address / landmark</label>
          <input id="landmark" name="landmark" required minLength={3} maxLength={200} className={`${field} w-72`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className={small}>Phone (optional)</label>
          <input id="phone" name="phone" maxLength={24} className={`${field} w-40`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="openingHours" className={small}>Opening hours (optional)</label>
          <input id="openingHours" name="openingHours" maxLength={80} className={`${field} w-48`} placeholder="Lun–Sam 8 h – 18 h" />
        </div>
        <button type="submit" className="h-10 rounded-lg bg-[#FF7A1A] px-4 text-sm font-bold text-[#0A2540]">Add pickup point</button>
      </form>

      <PointList cityId={city.id} cityName={city.name} />
    </>
  );
}

async function PointList({ cityId, cityName }: { cityId: string; cityName: string }) {
  const points = await prisma.pickupPoint.findMany({ where: { cityId }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  if (points.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-6 text-center font-bold">
        No pickup points in {cityName} yet. Add your shop or first partner above.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[#E3E7EC] text-xs uppercase tracking-wide text-[#5B6B7C]">
          <tr><th className="p-3">Name</th><th className="p-3">Commune</th><th className="p-3">Landmark</th><th className="p-3">Hours</th><th className="p-3">In the app</th></tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.id} className="border-b border-[#F0F2F5] last:border-0">
              <td className="p-3 font-bold">{p.name}<div className="text-xs font-normal text-[#5B6B7C]">{p.phone}</div></td>
              <td className="p-3">{p.commune}</td>
              <td className="p-3">{p.landmark}</td>
              <td className="p-3">{p.openingHours}</td>
              <td className="p-3">
                <form action={togglePickupPoint}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className={`rounded-md px-2 py-1 text-xs font-bold ${p.isActive ? 'bg-[#E7F6EC] text-[#15803D]' : 'bg-[#EEF1F4] text-[#5B6B7C]'}`}>
                    {p.isActive ? 'Shown — hide' : 'Hidden — show'}
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
