import { Suspense } from 'react';
import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { KINSHASA_COMMUNES } from '@/lib/delivery-fees';
import { addPickupPoint, togglePickupPoint } from './actions';

export default function PickupPointsPage() {
  const field = 'h-10 rounded-lg border border-[#C9D1DA] px-2 text-sm outline-none focus:border-[#0A2540]';
  const small = 'text-xs font-medium text-[#5B6B7C]';
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">Pickup points</h1>
        <p className="text-sm text-[#5B6B7C]">Partner shops where customers collect orders. Only active ones appear in the app.</p>
      </div>

      <form action={addPickupPoint} className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className={small}>Name</label>
          <input id="name" name="name" required minLength={2} maxLength={80} className={`${field} w-56`} placeholder="Soko Gombe" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="commune" className={small}>Commune</label>
          <select id="commune" name="commune" required defaultValue="" className={field}>
            <option value="" disabled>Choose…</option>
            {KINSHASA_COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
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

      <Suspense fallback={<p className="text-[#5B6B7C]">Loading…</p>}>
        <PointList />
      </Suspense>
    </div>
  );
}

async function PointList() {
  await connection();
  const points = await prisma.pickupPoint.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  if (points.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-center font-bold">No pickup points yet. Add your shop or first partner above.</p>;
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
