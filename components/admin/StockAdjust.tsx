'use client';

import { useActionState } from 'react';
import { adjustStock, type FormState } from '@/app/admin/products/actions';

/** Add or remove stock on one variant, with the reason recorded. */
export default function StockAdjust({ variantId }: { variantId: string }) {
  const [state, action, pending] = useActionState(adjustStock, {} as FormState);
  const id = (name: string) => `s-${variantId}-${name}`;
  const input = 'h-9 rounded-lg border border-[#C9D1DA] px-2 text-sm outline-none focus:border-[#0A2540]';

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="variantId" value={variantId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={id('change')} className="text-xs font-medium text-[#5B6B7C]">Change (+10 or -2)</label>
        <input id={id('change')} name="change" type="number" step="1" required className={`${input} w-28`} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('reason')} className="text-xs font-medium text-[#5B6B7C]">Reason</label>
        <select id={id('reason')} name="reason" className={input} defaultValue="PURCHASE">
          <option value="PURCHASE">New stock arrived</option>
          <option value="ADJUSTMENT">Counted and corrected</option>
          <option value="RETURN">Returned by a customer</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={id('note')} className="text-xs font-medium text-[#5B6B7C]">Note (optional)</label>
        <input id={id('note')} name="note" maxLength={200} className={`${input} w-48`} />
      </div>
      <button type="submit" disabled={pending} className="h-9 rounded-lg bg-[#0A2540] px-3 text-sm font-bold text-white disabled:opacity-60">
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state.error && <p role="alert" className="w-full text-sm font-medium text-[#BE123C]">{state.error}</p>}
      {state.message && <p className="w-full text-sm font-medium text-[#15803D]">{state.message}</p>}
    </form>
  );
}
