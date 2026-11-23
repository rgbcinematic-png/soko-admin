'use client';

import { useState } from 'react';
import { cdf, toNumber, usd } from '@/lib/money';
import { adjustedPrice, pctLabel, type CityPricingMode } from '@/lib/city-pricing';

/** A city as the product form shows it, with its adjustment on the generic price. */
export type CityColumn = { id: string; name: string; isActive: boolean; priceAdjustPct: number; priceRoundUsd: number };

/**
 * A variant in one city, kept as typed text until the server checks it.
 * priceUsd / compareAtUsd are the exact price, only used when pricing is EXACT.
 */
export type CityCell = { pricing: CityPricingMode; priceUsd: string; compareAtUsd: string; costUsd: string; openingStock: string };

/** One row in the form. Numbers are kept as typed text until the server checks them. */
export type VariantRow = {
  key: string;
  id?: string;
  label: string;
  sku: string;
  isActive: boolean;
  genericPriceUsd: string;
  genericCompareAtUsd: string;
  /** By city id. A saved variant with no row for a city is not sold there. */
  cities: Record<string, CityCell>;
};

/** New variants follow the generic price everywhere; a saved one missing a city is not sold there. */
const emptyCell = (saved: boolean): CityCell => ({
  pricing: saved ? 'OFF' : 'GENERIC',
  priceUsd: '',
  compareAtUsd: '',
  costUsd: '',
  openingStock: '',
});

const MODE_LABEL: Record<CityPricingMode, string> = { GENERIC: 'Generic', EXACT: 'Exact price', OFF: 'Not sold' };

let counter = 0;
// The first row has a fixed key: it is drawn on the server too, where a counter would not match the browser's.
const newRow = (label = '', key = `new-${++counter}`): VariantRow => ({
  key,
  label,
  sku: '',
  isActive: true,
  genericPriceUsd: '',
  genericCompareAtUsd: '',
  cities: {},
});

const input = 'h-10 w-full rounded-lg border border-[#C9D1DA] px-2 text-sm outline-none focus:border-[#0A2540]';
const small = 'text-xs font-medium text-[#5B6B7C]';
const hint = 'text-xs text-[#5B6B7C]';

export default function VariantsField({
  initial,
  rate,
  cities,
  stockByVariant = {},
}: {
  initial?: VariantRow[];
  rate: number | null;
  cities: CityColumn[];
  /** Current stock of saved variants: variant id → city id → units. */
  stockByVariant?: Record<string, Record<string, number>>;
}) {
  const [rows, setRows] = useState<VariantRow[]>(initial?.length ? initial : [newRow('Standard', 'new-first')]);

  const update = (key: string, patch: Partial<VariantRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateCell = (key: string, cityId: string, patch: Partial<CityCell>) =>
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, cities: { ...r.cities, [cityId]: { ...(r.cities[cityId] ?? emptyCell(!!r.id)), ...patch } } } : r,
      ),
    );

  const payload = rows.map((r) => ({
    id: r.id,
    label: r.label,
    sku: r.sku,
    isActive: r.isActive,
    genericPriceUsd: r.genericPriceUsd,
    genericCompareAtUsd: r.genericCompareAtUsd,
    cities: Object.fromEntries(
      cities.map((c) => {
        const cell = r.cities[c.id] ?? emptyCell(!!r.id);
        return [
          c.id,
          {
            pricing: cell.pricing,
            priceUsd: cell.priceUsd,
            compareAtUsd: cell.compareAtUsd,
            costUsd: cell.costUsd,
            openingStock: r.id ? 0 : cell.openingStock || 0,
          },
        ];
      }),
    ),
  }));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="variants" value={JSON.stringify(payload)} />

      {rows.map((r, i) => {
        const id = (name: string) => `v-${r.key}-${name}`;
        return (
          <fieldset
            key={r.key}
            className={`min-w-0 rounded-xl border p-3 ${r.isActive ? 'border-[#E3E7EC] bg-white' : 'border-dashed border-[#C9D1DA] bg-[#F4F5F7] opacity-70'}`}
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
              <div className="col-span-2 flex flex-col gap-1 md:col-span-3">
                <label htmlFor={id('sku')} className={small}>SKU (leave blank to create one)</label>
                <input id={id('sku')} className={input} value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} />
              </div>
              <div className="flex items-end">
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
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-[#F7F8FA] p-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={id('generic')} className={small}>Generic price ($)</label>
                <input id={id('generic')} className={`${input} w-32`} inputMode="decimal" value={r.genericPriceUsd}
                  onChange={(e) => update(r.key, { genericPriceUsd: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={id('generic-was')} className={small}>Generic &quot;was&quot; ($), optional</label>
                <input id={id('generic-was')} className={`${input} w-32`} inputMode="decimal" value={r.genericCompareAtUsd}
                  onChange={(e) => update(r.key, { genericCompareAtUsd: e.target.value })} />
              </div>
              <p className={`${hint} max-w-sm`}>
                Cities on &quot;Generic&quot; sell at this price plus their own % (set on the Cities page).
              </p>
            </div>

            {/* relative: keeps the hidden screen-reader labels inside the scrolling box on phones. */}
            <div className="relative mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="pb-1 text-left text-xs text-[#5B6B7C]">
                  Price and your cost per city: generic (with the city&apos;s %), an exact price, or not sold there.
                </caption>
                <thead className="text-xs text-[#5B6B7C]">
                  <tr>
                    <th className="py-1 pr-2 font-medium">City</th>
                    <th className="py-1 pr-2 font-medium">Price</th>
                    <th className="py-1 pr-2 font-medium">Price ($)</th>
                    <th className="py-1 pr-2 font-medium">Was ($)</th>
                    <th className="py-1 pr-2 font-medium">Your cost ($)</th>
                    <th className="py-1 pr-2 font-medium">{r.id ? 'In stock' : 'Opening stock'}</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((c) => {
                    const cell = r.cities[c.id] ?? emptyCell(!!r.id);
                    const generic = cell.pricing === 'GENERIC';
                    const price =
                      cell.pricing === 'OFF' ? null : generic ? adjustedPrice(toNumber(r.genericPriceUsd), c) : toNumber(cell.priceUsd);
                    const was = generic ? adjustedPrice(toNumber(r.genericCompareAtUsd), c) : null;
                    const cost = toNumber(cell.costUsd);
                    const margin = price && cost !== null && price > 0 ? Math.round(((price - cost) / price) * 100) : null;
                    const cid = (name: string) => id(`${c.id}-${name}`);
                    return (
                      <tr key={c.id} className="border-t border-[#F0F2F5] align-top">
                        <th scope="row" className="py-2 pr-2 font-bold">
                          {c.name}
                          {!c.isActive && <div className="text-xs font-normal text-[#5B6B7C]">closed</div>}
                        </th>
                        <td className="py-2 pr-2">
                          <label htmlFor={cid('mode')} className="sr-only">How {c.name} is priced</label>
                          <select id={cid('mode')} className={`${input} w-36`} value={cell.pricing}
                            onChange={(e) => {
                              const pricing = e.target.value as CityPricingMode;
                              // Switching to an exact price starts from what the city sells at now.
                              const start = pricing === 'EXACT' && !cell.priceUsd && price !== null
                                ? { priceUsd: String(price), compareAtUsd: was !== null ? String(was) : cell.compareAtUsd }
                                : {};
                              updateCell(r.key, c.id, { pricing, ...start });
                            }}>
                            {(['GENERIC', 'EXACT', 'OFF'] as const).map((m) => (
                              <option key={m} value={m}>{m === 'GENERIC' ? `Generic ${pctLabel(c.priceAdjustPct)}` : MODE_LABEL[m]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          {cell.pricing === 'EXACT' ? (
                            <>
                              <label htmlFor={cid('price')} className="sr-only">Exact price in {c.name} ($)</label>
                              <input id={cid('price')} className={`${input} w-28`} inputMode="decimal" value={cell.priceUsd}
                                onChange={(e) => updateCell(r.key, c.id, { priceUsd: e.target.value })} />
                            </>
                          ) : (
                            <span className="flex h-10 items-center font-bold">
                              {cell.pricing === 'OFF' ? '—' : price !== null ? usd(price) : <span className="font-normal text-[#B33A00]">enter generic price</span>}
                            </span>
                          )}
                          <div className={hint}>
                            {[rate && price ? `≈ ${cdf(price, rate)}` : '', margin !== null ? `margin ${margin}%` : ''].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          {cell.pricing === 'EXACT' ? (
                            <>
                              <label htmlFor={cid('was')} className="sr-only">Was price in {c.name} ($)</label>
                              <input id={cid('was')} className={`${input} w-24`} inputMode="decimal" value={cell.compareAtUsd}
                                onChange={(e) => updateCell(r.key, c.id, { compareAtUsd: e.target.value })} />
                            </>
                          ) : (
                            <span className="flex h-10 items-center text-[#5B6B7C]">{was !== null && cell.pricing !== 'OFF' ? usd(was) : '—'}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <label htmlFor={cid('cost')} className="sr-only">Your cost in {c.name} ($)</label>
                          <input id={cid('cost')} className={`${input} w-28`} inputMode="decimal" value={cell.costUsd}
                            onChange={(e) => updateCell(r.key, c.id, { costUsd: e.target.value })} />
                        </td>
                        <td className="py-2 pr-2">
                          {r.id ? (
                            <span className="flex h-10 items-center font-bold">{stockByVariant[r.id]?.[c.id] ?? 0}</span>
                          ) : (
                            <>
                              <label htmlFor={cid('stock')} className="sr-only">Opening stock in {c.name}</label>
                              <input id={cid('stock')} className={`${input} w-24`} inputMode="numeric" value={cell.openingStock}
                                onChange={(e) => updateCell(r.key, c.id, { openingStock: e.target.value })} />
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
