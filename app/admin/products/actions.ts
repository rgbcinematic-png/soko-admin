'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { nextProductRef, slugify, uniqueSlug } from '@/lib/catalog';

export type FormState = { error?: string; message?: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authorised');
  return session.user;
}

/** Empty box → null; otherwise a dollar amount between 0 and 1,000,000. */
const optionalMoney = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.number().min(0, 'cannot be negative').max(1_000_000, 'is too large').nullable(),
);

const FIELD_NAMES: Record<string, string> = {
  title: 'Title',
  categoryId: 'Category',
  brand: 'Brand',
  summary: 'Short summary',
  description: 'Description',
  status: 'Status',
  warrantyMonths: 'Warranty',
  installPriceUsd: 'Installation price',
  specsText: 'Specifications',
  label: 'label',
  sku: 'SKU',
  priceUsd: 'price',
  compareAtUsd: '"was" price',
  costUsd: 'cost',
  openingStock: 'opening stock',
};

function firstIssue(error: z.ZodError, variantRows = false): string {
  const issue = error.issues[0];
  if (!issue) return 'Please check the form.';
  if (variantRows && typeof issue.path[0] === 'number') {
    const field = FIELD_NAMES[String(issue.path[1])] ?? '';
    return `Variant ${issue.path[0] + 1}${field ? ` ${field}` : ''}: ${issue.message}`;
  }
  const field = FIELD_NAMES[String(issue.path[0])];
  return field ? `${field}: ${issue.message}` : issue.message;
}

const ProductInput = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, 'at least 3 characters').max(160, 'at most 160 characters'),
  categoryId: z.string().min(1, 'choose one'),
  brand: z.string().trim().max(60).optional(),
  summary: z.string().trim().max(400, 'at most 400 characters').optional(),
  description: z.string().trim().max(8000, 'at most 8,000 characters').optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  warrantyMonths: z.coerce.number().int('whole months only').min(0).max(120, 'at most 120 months'),
  installPriceUsd: optionalMoney,
  specsText: z.string().max(3000).optional(),
});

const VariantInput = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, 'needs a name, e.g. Standard or 43"').max(60),
  sku: z.string().trim().max(40).optional().default(''),
  priceUsd: z.coerce.number().positive('needs a price above $0').max(1_000_000, 'is too large'),
  compareAtUsd: optionalMoney,
  costUsd: optionalMoney,
  openingStock: z.coerce.number().int('whole units only').min(0, 'cannot be negative').max(100_000).optional().default(0),
  isActive: z.boolean().default(true),
});

/** "Résolution | Full HD" per line → [{ label, value }] */
function parseSpecs(text?: string) {
  return (text ?? '')
    .split('\n')
    .map((line) => line.split('|').map((s) => s.trim()))
    .filter(([label, value]) => label && value)
    .slice(0, 30)
    .map(([label, value]) => ({ label: label.slice(0, 60), value: value.slice(0, 200) }));
}

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const text = (name: string) => {
    const v = formData.get(name);
    return v === null ? undefined : String(v);
  };

  const parsed = ProductInput.safeParse({
    id: text('id') || undefined,
    title: text('title'),
    categoryId: text('categoryId'),
    brand: text('brand'),
    summary: text('summary'),
    description: text('description'),
    status: text('status'),
    warrantyMonths: text('warrantyMonths') || 0,
    installPriceUsd: text('installPriceUsd'),
    specsText: text('specsText'),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;

  let rawVariants: unknown;
  try {
    rawVariants = JSON.parse(text('variants') ?? '[]');
  } catch {
    return { error: 'The variants could not be read. Reload the page and try again.' };
  }
  const v = z.array(VariantInput).max(30, 'at most 30 variants').safeParse(rawVariants);
  if (!v.success) return { error: firstIssue(v.error, true) };
  const variants = v.data.map((row) => ({ ...row, sku: row.sku.toUpperCase() }));

  const installAvailable = formData.get('installAvailable') === 'on';
  const instalmentsAllowed = formData.get('instalmentsAllowed') === 'on';
  const bigItem = formData.get('bigItem') === 'on';
  const featured = formData.get('featured') === 'on';

  if (variants.length === 0) {
    return { error: 'Add at least one variant. Use "Standard" if the product has no options.' };
  }
  if (d.status === 'ACTIVE' && !variants.some((row) => row.isActive)) {
    return { error: 'An active product needs at least one active variant.' };
  }
  if (installAvailable && d.installPriceUsd === null) {
    return { error: 'Enter the installation price, or untick "Installation available".' };
  }
  const typedSkus = variants.map((row) => row.sku).filter(Boolean);
  if (new Set(typedSkus).size !== typedSkus.length) {
    return { error: 'Two variants have the same SKU.' };
  }

  const category = await prisma.category.findUnique({ where: { id: d.categoryId }, select: { id: true } });
  if (!category) return { error: 'Category: that category no longer exists. Reload the page.' };

  const existing = d.id
    ? await prisma.product.findUnique({ where: { id: d.id }, include: { variants: true } })
    : null;
  if (d.id && !existing) return { error: 'This product no longer exists.' };

  if (typedSkus.length) {
    const clash = await prisma.productVariant.findFirst({
      where: { sku: { in: typedSkus }, ...(existing ? { productId: { not: existing.id } } : {}) },
      select: { sku: true },
    });
    if (clash) return { error: `SKU ${clash.sku} is already used by another product.` };
  }

  const ref = existing?.ref ?? (await nextProductRef());
  const slug = await uniqueSlug(slugify(d.title), existing?.id);
  const images = formData
    .getAll('image')
    .map(String)
    .filter((url) => url.startsWith('https://'))
    .slice(0, 12);

  // Fill in any blank SKU: SK-2610-0001-1, -2…, skipping ones already taken.
  const skuBase = ref.replace('SK-P-', 'SK-');
  const taken = new Set([...(existing?.variants.map((x) => x.sku) ?? []), ...typedSkus]);
  let counter = 1;
  for (const row of variants) {
    if (row.sku) continue;
    while (taken.has(`${skuBase}-${counter}`)) counter++;
    row.sku = `${skuBase}-${counter}`;
    taken.add(row.sku);
  }

  const data = {
    title: d.title,
    slug,
    status: d.status,
    categoryId: d.categoryId,
    brand: d.brand || null,
    summary: d.summary || null,
    description: d.description || null,
    images,
    specs: parseSpecs(d.specsText),
    warrantyMonths: d.warrantyMonths,
    installAvailable,
    installPriceUsd: installAvailable ? d.installPriceUsd : null,
    instalmentsAllowed,
    bigItem,
    featured,
    publishedAt: d.status === 'ACTIVE' ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
  };

  let productId: string;
  try {
    productId = await prisma.$transaction(
      async (tx) => {
        const product = existing
          ? await tx.product.update({ where: { id: existing.id }, data })
          : await tx.product.create({ data: { ...data, ref } });

        const kept = new Set<string>();
        for (const [position, row] of variants.entries()) {
          const common = {
            label: row.label,
            sku: row.sku,
            priceUsd: row.priceUsd,
            compareAtUsd: row.compareAtUsd,
            costUsd: row.costUsd,
            isActive: row.isActive,
            position,
          };
          if (row.id && existing?.variants.some((x) => x.id === row.id)) {
            await tx.productVariant.update({ where: { id: row.id }, data: common });
            kept.add(row.id);
          } else {
            const created = await tx.productVariant.create({
              data: { ...common, productId: product.id, stock: row.openingStock },
            });
            if (row.openingStock > 0) {
              await tx.stockMovement.create({
                data: {
                  variantId: created.id,
                  change: row.openingStock,
                  reason: 'PURCHASE',
                  note: 'Opening stock',
                  byId: user.id,
                },
              });
            }
          }
        }

        // A variant missing from the form is switched off, never deleted,
        // so past orders keep pointing at it.
        if (existing) {
          const dropped = existing.variants.filter((x) => !kept.has(x.id)).map((x) => x.id);
          if (dropped.length) {
            await tx.productVariant.updateMany({ where: { id: { in: dropped } }, data: { isActive: false } });
          }
        }
        return product.id;
      },
      { timeout: 20_000 },
    );
  } catch (e) {
    console.error('saveProduct failed', e);
    return { error: 'The product could not be saved. Please try again.' };
  }

  redirect(`/admin/products/${productId}?saved=${existing ? 'updated' : 'created'}`);
}

const StockInput = z.object({
  variantId: z.string().min(1),
  change: z.coerce
    .number()
    .int('whole units only')
    .min(-100_000)
    .max(100_000)
    .refine((n) => n !== 0, 'enter a number other than 0'),
  reason: z.enum(['PURCHASE', 'RETURN', 'ADJUSTMENT']),
  note: z.string().trim().max(200).optional(),
});

/** Add or remove stock on one variant, and record why. */
export async function adjustStock(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = StockInput.safeParse({
    variantId: formData.get('variantId'),
    change: formData.get('change'),
    reason: formData.get('reason'),
    note: formData.get('note') ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue?.path[0] === 'change' ? 'Change: ' : ''}${issue?.message ?? 'Check the form.'}` };
  }
  const d = parsed.data;

  try {
    const after = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: d.variantId }, select: { stock: true } });
      if (!variant) throw new Error('missing');
      if (variant.stock + d.change < 0) throw new Error('negative');
      const updated = await tx.productVariant.update({
        where: { id: d.variantId },
        data: { stock: { increment: d.change } },
        select: { stock: true },
      });
      await tx.stockMovement.create({
        data: { variantId: d.variantId, change: d.change, reason: d.reason, note: d.note || null, byId: user.id },
      });
      return updated.stock;
    });
    refresh();
    return { message: `Saved. Stock is now ${after}.` };
  } catch (e) {
    if (e instanceof Error && e.message === 'negative') return { error: 'That would take stock below zero.' };
    if (e instanceof Error && e.message === 'missing') return { error: 'This variant no longer exists.' };
    console.error('adjustStock failed', e);
    return { error: 'Stock could not be saved. Please try again.' };
  }
}

/** The day's rate, from the box at the top of the admin. */
export async function setRate(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = z.coerce.number().min(100).max(100_000).safeParse(formData.get('cdfPerUsd'));
  if (!parsed.success) return;
  await prisma.exchangeRate.create({ data: { cdfPerUsd: parsed.data, setById: user.id } });
  refresh();
}
