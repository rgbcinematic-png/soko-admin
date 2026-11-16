'use client';

import { useActionState } from 'react';
import { addCourier, type CourierFormState } from '@/app/admin/couriers/actions';

/** Add a courier in one city. Errors come back from the server and the typed values stay. */
export default function CourierForm({ cityId, cityName }: { cityId: string; cityName: string }) {
  const [state, action, pending] = useActionState(addCourier, {} as CourierFormState);
  const field = 'h-10 rounded-lg border border-[#C9D1DA] px-2 text-sm outline-none focus:border-[#0A2540]';
  const small = 'text-xs font-medium text-[#5B6B7C]';

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5">
      <input type="hidden" name="cityId" value={cityId} />
      <h2 className="w-full text-lg font-extrabold">Add a courier in {cityName}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="c-name" className={small}>Name</label>
        <input id="c-name" name="name" required minLength={2} maxLength={80} className={`${field} w-56`} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="c-phone" className={small}>Phone</label>
        <input id="c-phone" name="phone" required type="tel" maxLength={24} className={`${field} w-44`} placeholder="0812345678" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="c-vehicle" className={small}>Vehicle</label>
        <select id="c-vehicle" name="vehicle" defaultValue="MOTO" className={field}>
          <option value="MOTO">Motorbike</option>
          <option value="VAN">Van (big items)</option>
          <option value="CAR">Car</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="h-10 rounded-lg bg-[#FF7A1A] px-4 text-sm font-bold text-[#0A2540] disabled:opacity-60">
        {pending ? 'Adding…' : 'Add courier'}
      </button>
      {state.error && <p role="alert" className="w-full text-sm font-medium text-[#BE123C]">{state.error}</p>}
      {state.message && <p role="status" className="w-full text-sm font-medium text-[#15803D]">{state.message}</p>}
    </form>
  );
}
