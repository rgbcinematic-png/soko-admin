import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/auth';
import { pickCity } from '@/lib/cities';
import { getDeliverySettings } from '@/lib/delivery-settings';
import { saveCommunes, saveDeliveryOptions } from './actions';

type Search = Promise<{ city?: string }>;

export default function DeliveryPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Delivery</h1>
        <p className="text-sm text-[#5B6B7C]">
          Each city has its own prices and communes, in US dollars. Changes reach the app straight away; orders already
          placed keep their price.
        </p>
      </div>
      <Suspense fallback={<p className="text-[#5B6B7C]">Loading…</p>}>
        <DeliveryForms searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DeliveryForms({ searchParams }: { searchParams: Search }) {
  await connection();
  const [sp, session] = await Promise.all([searchParams, auth()]);
  const { cities, city } = await pickCity(sp.city);
  if (!city) return <p className="rounded-2xl bg-white p-6 font-bold">No cities yet.</p>;
  const settings = await getDeliverySettings(city.id);
  const canEdit = session?.user?.role === 'ADMIN';
  const unsaved = settings.methods.every((m) => !m.saved);
  const field = 'h-10 w-24 rounded-lg border border-[#C9D1DA] px-2 text-right text-sm outline-none focus:border-[#0A2540] disabled:bg-[#F4F5F7]';
  const save = 'h-10 self-start rounded-lg bg-[#FF7A1A] px-4 text-sm font-bold text-[#0A2540] disabled:opacity-50';
  const off = settings.communes.filter((c) => !c.isServed).length;

  return (
    <>
      {!canEdit && (
        <p className="rounded-2xl bg-[#FFF3C4] p-4 text-sm font-medium">Only an Administrator can change delivery prices.</p>
      )}

      <nav aria-label="Cities" className="flex flex-wrap gap-2">
        {cities.map((c) => (
          <Link
            key={c.id}
            href={`/admin/delivery?city=${c.id}`}
            aria-current={c.id === city.id ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold ${c.id === city.id ? 'bg-[#0A2540] text-white' : 'bg-white'}`}
          >
            {c.name}
            {!c.isActive && <span className="font-medium opacity-70"> · closed</span>}
          </Link>
        ))}
      </nav>

      <form action={saveDeliveryOptions} className="flex flex-col gap-4 rounded-2xl bg-white p-5">
        <input type="hidden" name="cityId" value={city.id} />
        <h2 className="text-lg font-extrabold">Delivery types in {city.name}</h2>
        {unsaved && (
          <p className="rounded-xl bg-[#FFF3C4] p-3 text-sm font-medium">
            No delivery prices for {city.name} yet. Enter a price for each type (0 for free), tick the ones you offer,
            and save.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-[#E3E7EC] text-xs uppercase tracking-wide text-[#5B6B7C]">
              <tr><th className="p-3">Type (as shoppers see it)</th><th className="p-3">Price ($)</th><th className="p-3">Offered</th></tr>
            </thead>
            <tbody>
              {settings.methods.map((m) => (
                <tr key={m.id} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="p-3">
                    <label htmlFor={`fee_${m.id}`} className="font-bold">{m.label}</label>
                    <div className="text-xs text-[#5B6B7C]">{m.detail}</div>
                  </td>
                  <td className="p-3">
                    <input id={`fee_${m.id}`} name={`fee_${m.id}`} type="number" min={0} max={1000} step={0.01} required
                      defaultValue={m.saved ? m.feeUsd : ''} disabled={!canEdit} className={field} />
                  </td>
                  <td className="p-3">
                    <input type="checkbox" name={`active_${m.id}`} defaultChecked={m.isActive} disabled={!canEdit}
                      aria-label={`Offer ${m.label}`} className="h-5 w-5 accent-[#0A2540]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#5B6B7C]">Pickup only appears in the app when at least one pickup point is shown.</p>
        <button type="submit" disabled={!canEdit} className={save}>Save delivery types</button>
      </form>

      <form action={saveCommunes} className="flex flex-col gap-4 rounded-2xl bg-white p-5">
        <input type="hidden" name="cityId" value={city.id} />
        <div>
          <h2 className="text-lg font-extrabold">Communes of {city.name}</h2>
          <p className="text-sm text-[#5B6B7C]">
            Untick a commune to stop home delivery there. The extra charge is added to the delivery price for that commune.
            {off > 0 && <b> {off} commune{off > 1 ? 's' : ''} not served.</b>}
          </p>
        </div>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {settings.communes.map((c) => (
            <div key={c.name} className="flex items-center justify-between gap-3 border-b border-[#F0F2F5] py-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name={`served_${c.name}`} defaultChecked={c.isServed} disabled={!canEdit}
                  className="h-5 w-5 accent-[#0A2540]" />
                {c.name}
              </label>
              <span className="flex items-center gap-1 text-xs text-[#5B6B7C]">
                + $
                <input name={`extra_${c.name}`} type="number" min={0} max={1000} step={0.01} defaultValue={c.surchargeUsd}
                  disabled={!canEdit} aria-label={`Extra charge for ${c.name}`} className={`${field} w-20`} />
              </span>
            </div>
          ))}
        </div>
        <button type="submit" disabled={!canEdit} className={save}>Save communes</button>
      </form>
    </>
  );
}
