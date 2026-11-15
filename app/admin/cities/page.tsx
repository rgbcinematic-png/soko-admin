import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/auth';
import { allCities, cityReadiness } from '@/lib/cities';
import { toggleCity } from './actions';

type Search = Promise<{ error?: string }>;

export default function CitiesPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Cities</h1>
        <p className="text-sm text-[#5B6B7C]">
          Shoppers choose the city they want delivery in, and see that city&apos;s prices and stock. A city opens only
          once it has delivery prices and at least one product with a price and stock.
        </p>
      </div>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading…</p>}>
        <CityList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CityList({ searchParams }: { searchParams: Search }) {
  await connection();
  const [sp, session, cities] = await Promise.all([searchParams, auth(), allCities()]);
  const canEdit = session?.user?.role === 'ADMIN';
  const ready = await Promise.all(cities.map((c) => cityReadiness(c.id)));

  return (
    <>
      {sp.error && <p role="alert" className="rounded-xl bg-[#FDE8EC] p-3 font-bold text-[#BE123C]">{sp.error}</p>}
      {!canEdit && (
        <p className="rounded-2xl bg-[#FFF3C4] p-4 text-sm font-medium">Only an Administrator can open or close a city.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cities.map((c, i) => {
          const r = ready[i];
          const checks = [
            { ok: r.deliveryTypes > 0, text: `${r.deliveryTypes} delivery type${r.deliveryTypes === 1 ? '' : 's'} offered`, href: `/admin/delivery?city=${c.id}` },
            { ok: r.servedCommunes > 0, text: `${r.servedCommunes} commune${r.servedCommunes === 1 ? '' : 's'} with home delivery`, href: `/admin/delivery?city=${c.id}` },
            { ok: r.pickupPoints > 0, text: `${r.pickupPoints} pickup point${r.pickupPoints === 1 ? '' : 's'}`, href: `/admin/pickup-points?city=${c.id}` },
            { ok: r.productsInStock > 0, text: `${r.productsInStock} product${r.productsInStock === 1 ? '' : 's'} with a price and stock`, href: '/admin/products' },
          ];
          return (
            <section key={c.id} className="flex flex-col gap-3 rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold">{c.name}</h2>
                <span className={`rounded-md px-2 py-1 text-xs font-bold ${c.isActive ? 'bg-[#E7F6EC] text-[#15803D]' : 'bg-[#EEF1F4] text-[#5B6B7C]'}`}>
                  {c.isActive ? 'Open to shoppers' : 'Closed'}
                </span>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {checks.map((k) => (
                  <li key={k.text}>
                    <Link href={k.href} className="hover:underline">
                      <span aria-hidden="true" className={k.ok ? 'text-[#15803D]' : 'text-[#5B6B7C]'}>{k.ok ? '✓' : '○'}</span> {k.text}
                    </Link>
                  </li>
                ))}
              </ul>
              {!c.isActive && r.missing.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-[#7A5A00]">
                  {r.missing.map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
              <form action={toggleCity} className="mt-auto">
                <input type="hidden" name="cityId" value={c.id} />
                <button
                  type="submit"
                  disabled={!canEdit || (!c.isActive && r.missing.length > 0)}
                  className={`h-10 rounded-lg px-4 text-sm font-bold disabled:opacity-40 ${c.isActive ? 'border border-[#BE123C] text-[#BE123C]' : 'bg-[#FF7A1A] text-[#0A2540]'}`}
                >
                  {c.isActive ? `Close ${c.name}` : `Open ${c.name} to shoppers`}
                </button>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
