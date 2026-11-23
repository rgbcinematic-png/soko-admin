import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/auth';
import { allCities, cityReadiness } from '@/lib/cities';
import { prisma } from '@/lib/prisma';
import { ROUND_STEPS, adjustedPrice, pctLabel, roundLabel } from '@/lib/city-pricing';
import { toNumber, usd } from '@/lib/money';
import { sellAllGeneric, setCityPricing, toggleCity } from './actions';

type Search = Promise<{ error?: string; saved?: string }>;

export default function CitiesPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Cities</h1>
        <p className="text-sm text-[#5B6B7C]">
          Shoppers choose the city they want delivery in, and see that city&apos;s prices and stock. A city opens only
          once it has delivery prices and at least one product with a price and stock.
        </p>
        <p className="mt-1 text-sm text-[#5B6B7C]">
          <strong>Prices:</strong> each product has one generic price. Each city sells it at that price plus its own
          adjustment below (for transport, for example), unless the product has an exact price for that city.
          New products follow the adjustment automatically.
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
  const [ready, counts] = await Promise.all([
    Promise.all(cities.map((c) => cityReadiness(c.id))),
    prisma.variantCity.groupBy({ by: ['cityId', 'pricing'], _count: true }),
  ]);
  const count = (cityId: string, pricing: string) =>
    counts.find((r) => r.cityId === cityId && r.pricing === pricing)?._count ?? 0;
  const field = 'h-10 rounded-lg border border-[#C9D1DA] px-2 text-sm outline-none focus:border-[#0A2540] disabled:bg-[#F4F5F7]';

  return (
    <>
      {sp.error && <p role="alert" className="rounded-xl bg-[#FDE8EC] p-3 font-bold text-[#BE123C]">{sp.error}</p>}
      {sp.saved && <p role="status" className="rounded-xl bg-[#E7F6EC] p-3 font-bold text-[#15803D]">{sp.saved}</p>}
      {!canEdit && (
        <p className="rounded-2xl bg-[#FFF3C4] p-4 text-sm font-medium">Only an Administrator can open or close a city, or change its prices.</p>
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
              <div className="flex flex-col gap-2 rounded-xl bg-[#F7F8FA] p-3">
                <h3 className="text-sm font-extrabold">Prices here</h3>
                <form key={`${c.priceAdjustPct}-${c.priceRoundUsd}`} action={setCityPricing} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="cityId" value={c.id} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`pct-${c.id}`} className="text-xs font-medium text-[#5B6B7C]">Generic price + (%)</label>
                    <input id={`pct-${c.id}`} name="pct" inputMode="decimal" defaultValue={toNumber(c.priceAdjustPct) ?? 0}
                      disabled={!canEdit} className={`${field} w-20`} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`round-${c.id}`} className="text-xs font-medium text-[#5B6B7C]">Rounding</label>
                    <select id={`round-${c.id}`} name="round" defaultValue={String(toNumber(c.priceRoundUsd) ?? 0.01)}
                      disabled={!canEdit} className={field}>
                      {ROUND_STEPS.map((step) => <option key={step} value={String(step)}>{roundLabel(step)}</option>)}
                    </select>
                  </div>
                  <button type="submit" disabled={!canEdit} className="h-10 rounded-lg bg-[#0A2540] px-3 text-sm font-bold text-white disabled:opacity-40">
                    Save
                  </button>
                </form>
                <p className="text-xs text-[#5B6B7C]">
                  Now {pctLabel(c.priceAdjustPct)}, {roundLabel(c.priceRoundUsd)}: a {usd(100)} generic price is{' '}
                  <strong>{usd(adjustedPrice(100, c))}</strong> here. Saving updates every price that follows it at once.
                </p>
                <p className="text-xs text-[#5B6B7C]">
                  {count(c.id, 'GENERIC')} at the generic price · {count(c.id, 'EXACT')} with an exact price
                </p>
                {canEdit && (
                  <form action={sellAllGeneric}>
                    <input type="hidden" name="cityId" value={c.id} />
                    <button type="submit" className="text-left text-xs font-bold text-[#B33A00] underline">
                      Sell every product not sold here yet at the generic price
                    </button>
                  </form>
                )}
              </div>
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
