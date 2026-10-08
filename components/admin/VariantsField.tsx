'use client';

import { useState } from 'react';
import { cdf, toNumber } from '@/lib/money';

/** One row in the form. Numbers are kept as typed text until the server checks them. */
export type VariantRow = {
  key: string;
  id?: string;
  label: string;
  sku: string;
  priceUsd: string;
  compareAtUsd: string;
  costUsd: string;
  openingStock: string;
  isActive: boolean;
};

let counter = 0;
const newRow = (label = ''): VariantRow => ({
  key: `new-${++counter}`,
  label,
  sku: '',
  priceUsd: '',
  compareAtUsd: '',
  costUsd: '',
  openingStock: '',
  isActive: true,
});

const input = 'h-10 w-full rounded-lg border border-[#C9D1DA] px-2 text-sm outline-none focus:border-[#0A2540]';
const small = 'text-xs font-medium text-[#5B6B7C]';

export default function VariantsField({
  initial,
  rate,
  stockById = {},
}: {
  initial?: VariantRow[];
  rate: number | null;
  stockById?: Record<string, number>;
}) {
  const [rows, setRows] = useState<VariantRow[]>(initial?.length ? initial : [newRow('Standard')]);

  const update = (key: string, patch: Partial<VariantRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const payload = rows.map((r) => ({
    id: r.id,
    label: r.label,
    sku: r.sku,
    priceUsd: r.priceUsd,
    compareAtUsd: r.compareAtUsd,
    costUsd: r.costUsd,
    openingStock: r.id ? 0 : r.openingStock || 0,
    isActive: r.isActive,
  }));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="variants" value={JSON.stringify(payload)} />

      {rows.map((r, i) => {
        const price = toNumber(r.priceUsd);
        const cost = toNumber(r.costUsd);
        const margin = price && cost !== null && price > 0 ? Math.round(((price - cost) / price) * 100) : null;
        const id = (name: string) => `v-${r.key}-${name}`;
        return (
          <fieldset
            key={r.key}
            className={`rounded-xl border p-3 ${r.isActive ? 'border-[#E3E7EC] bg-white' : 'border-dashed border-[#C9D1DA] bg-[#F4F5F7] opacity-70'}`}
          >
            <legend className="px-1 text-sm font-bold">
              Variant {i + 1}
              {!r.isActive && ' · switched off'}
            </legend>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <div className="col-span-2 flex flex-col gap-1">
                <label htmlFor={id('label')} className={small}>Name (e.g. 43&quot; or M / Bleu)</label>
                <input id={id('label')} className={input} value={r.label} onChange={(e) => update(r.key, { label: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={id('price')} className={small}>Price ($)</label>
                <input id={id('price')} className={input} inputMode="decimal" value={r.priceUsd} onChange={(e) => update(r.key, { priceUsd: e.target.value })} />
                {rate && price ? <span className="text-xs text-[#5B6B7C]">≈ {cdf(price, rate)}</span> : null}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={id('was')} className={small}>Was ($), optional</label>
                <input id={id('was')} className={input} inputMode="decimal" value={r.compareAtUsd} onChange={(e) => update(r.key, { compareAtUsd: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={id('cost')} className={small}>Your cost ($)</label>
                <input id={id('cost')} className={input} inputMode="decimal" value={r.costUsd} onChange={(e) => update(r.key, { costUsd: e.target.value })} />
                {margin !== null ? <span className="text-xs text-[#5B6B7C]">Margin {margin}%</span> : null}
              </div>
              <div className="flex flex-col gap-1">
                {r.id ? (
                  <>
                    <span className={small}>In stock</span>
                    <span className="flex h-10 items-center text-sm font-bold">{stockById[r.id] ?? 0}</span>
                  </>
                ) : (
                  <>
                    <label htmlFor={id('stock')} className={small}>Opening stock</label>
                    <input id={id('stock')} className={input} inputMode="numeric" value={r.openingStock} onChange={(e) => update(r.key, { openingStock: e.target.value })} />
                  </>
                )}
              </div>
              <div className="col-span-2 flex flex-col gap-1 md:col-span-3">
                <label htmlFor={id('sku')} className={small}>SKU (leave blank to create one)</label>
                <input id={id('sku')} className={input} value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} />
              </div>
              <div className="col-span-2 flex items-end md:col-span-3">
                {r.id ? (
                  <label className="flex h-10 items-center gap-2 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={r.isActive} onChange={(e) => update(r.key, { isActive: e.target.checked })} />
                    On sale
                  </label>
                ) : (
                  <button
                    type="button"
                    className="h-10 rounded-lg px-3 text-sm font-bold text-[#BE123C] disabled:opacity-40"
                    disabled={rows.length === 1}
                    onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  >
                    Remove this variant
                  </button>
                )}
              </div>
            </div>
          </fieldset>
        );
      })}

      <div>
        <button
          type="button"
          className="h-10 rounded-lg border border-[#0A2540] px-4 text-sm font-bold"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          disabled={rows.length >= 30}
        >
          + Add a variant
        </button>
      </div>
      <p className="text-sm text-[#5B6B7C]">
        Saved variants can be switched off but not deleted, so old orders still show what was bought.
        To change stock on a saved variant, use the Stock section below the form.
      </p>
    </div>
  );
}
