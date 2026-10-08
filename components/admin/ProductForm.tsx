'use client';

import { startTransition, useActionState, useState } from 'react';
import { saveProduct, type FormState } from '@/app/admin/products/actions';
import type { CategoryOption } from '@/lib/catalog';
import ImageGalleryField from './ImageGalleryField';
import VariantsField, { type VariantRow } from './VariantsField';

export type ProductInitial = {
  id: string;
  title: string;
  categoryId: string;
  brand: string;
  summary: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  featured: boolean;
  warrantyMonths: number;
  installAvailable: boolean;
  installPriceUsd: string;
  instalmentsAllowed: boolean;
  bigItem: boolean;
  images: string[];
  specsText: string;
  variants: VariantRow[];
};

const input = 'h-11 w-full rounded-lg border border-[#C9D1DA] px-3 outline-none focus:border-[#0A2540]';
const label = 'text-sm font-medium';
const section = 'flex flex-col gap-4 rounded-2xl bg-white p-5';
const heading = 'text-lg font-extrabold';

export default function ProductForm({
  categories,
  rate,
  initial,
  stockById,
}: {
  categories: CategoryOption[];
  rate: number | null;
  initial?: ProductInitial;
  stockById?: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState(saveProduct, {} as FormState);
  const [installOn, setInstallOn] = useState(initial?.installAvailable ?? false);

  // Submitting this way keeps what was typed if the server sends back an error.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <section className={section}>
        <h2 className={heading}>Basics</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className={label}>Title (as shoppers will see it, in French)</label>
          <input id="title" name="title" required minLength={3} maxLength={160} defaultValue={initial?.title} className={input} placeholder='Téléviseur LED Smart 43"' />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="categoryId" className={label}>Category</label>
            <select id="categoryId" name="categoryId" required defaultValue={initial?.categoryId ?? ''} className={input}>
              <option value="" disabled>Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="brand" className={label}>Brand (optional)</label>
            <input id="brand" name="brand" maxLength={60} defaultValue={initial?.brand} className={input} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className={label}>Status</label>
            <select id="status" name="status" defaultValue={initial?.status ?? 'DRAFT'} className={input}>
              <option value="DRAFT">Draft (hidden from shoppers)</option>
              <option value="ACTIVE">Active (on sale)</option>
              <option value="ARCHIVED">Archived (no longer sold)</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="featured" defaultChecked={initial?.featured} className="h-5 w-5" />
          Feature on the home screen
        </label>
      </section>

      <section className={section}>
        <h2 className={heading}>Description</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="summary" className={label}>Short summary (one or two lines)</label>
          <textarea id="summary" name="summary" rows={2} maxLength={400} defaultValue={initial?.summary} className={`${input} h-auto py-2`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="description" className={label}>Full description</label>
          <textarea id="description" name="description" rows={6} maxLength={8000} defaultValue={initial?.description} className={`${input} h-auto py-2`} />
        </div>
      </section>

      <section className={section}>
        <h2 className={heading}>Photos</h2>
        <ImageGalleryField defaultValue={initial?.images} />
      </section>

      <section className={section}>
        <h2 className={heading}>Variants, prices and stock</h2>
        <VariantsField initial={initial?.variants} rate={rate} stockById={stockById} />
      </section>

      <section className={section}>
        <h2 className={heading}>Services</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="warrantyMonths" className={label}>Warranty (months, 0 for none)</label>
            <input id="warrantyMonths" name="warrantyMonths" type="number" min={0} max={120} step={1} defaultValue={initial?.warrantyMonths ?? 0} className={input} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="installAvailable" checked={installOn} onChange={(e) => setInstallOn(e.target.checked)} className="h-5 w-5" />
          Installation available
        </label>
        {installOn && (
          <div className="flex max-w-xs flex-col gap-1">
            <label htmlFor="installPriceUsd" className={label}>Installation price ($)</label>
            <input id="installPriceUsd" name="installPriceUsd" inputMode="decimal" defaultValue={initial?.installPriceUsd} className={input} />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="instalmentsAllowed" defaultChecked={initial?.instalmentsAllowed} className="h-5 w-5" />
          Payable en 3 fois (instalments)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="bigItem" defaultChecked={initial?.bigItem} className="h-5 w-5" />
          Big item: needs the van, not a motorbike
        </label>
      </section>

      <section className={section}>
        <h2 className={heading}>Specifications</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="specsText" className={label}>One per line, as &quot;Label | Value&quot;</label>
          <textarea
            id="specsText"
            name="specsText"
            rows={5}
            maxLength={3000}
            defaultValue={initial?.specsText}
            placeholder={'Résolution | Full HD 1080p\nEntrées | 2 × HDMI, 2 × USB'}
            className={`${input} h-auto py-2 font-mono text-sm`}
          />
        </div>
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-4 rounded-2xl border border-[#E3E7EC] bg-white p-4">
        <button type="submit" disabled={pending} className="h-12 rounded-xl bg-[#FF7A1A] px-6 font-bold text-[#0A2540] disabled:opacity-60">
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Create product'}
        </button>
        {state.error && <p role="alert" className="text-sm font-medium text-[#BE123C]">{state.error}</p>}
      </div>
    </form>
  );
}
