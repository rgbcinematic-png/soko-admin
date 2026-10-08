import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentRate } from '@/lib/rate';
import { toNumber } from '@/lib/money';

/**
 * What shoppers are allowed to see. Only ACTIVE products and variants that are
 * switched on — never your cost prices, drafts or internal notes.
 */
export const SHOPPER_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

export const onSale: Prisma.ProductWhereInput = {
  status: 'ACTIVE',
  variants: { some: { isActive: true } },
};

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  brand: true,
  images: true,
  installAvailable: true,
  instalmentsAllowed: true,
  bigItem: true,
  variants: {
    where: { isActive: true },
    select: { priceUsd: true, compareAtUsd: true, stock: true },
  },
} satisfies Prisma.ProductSelect;

type SummaryRow = Prisma.ProductGetPayload<{ select: typeof summarySelect }>;

/** A product card: cheapest on-sale price, its "was" price, and whether any stock is left. */
function toSummary(p: SummaryRow) {
  const cheapest = [...p.variants].sort((a, b) => (toNumber(a.priceUsd) ?? 0) - (toNumber(b.priceUsd) ?? 0))[0];
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    image: p.images[0] ?? null,
    priceUsd: toNumber(cheapest?.priceUsd) ?? 0,
    compareAtUsd: toNumber(cheapest?.compareAtUsd),
    hasOptions: p.variants.length > 1,
    inStock: p.variants.some((v) => v.stock > 0),
    installAvailable: p.installAvailable,
    instalmentsAllowed: p.instalmentsAllowed,
    bigItem: p.bigItem,
  };
}
export type ProductSummary = ReturnType<typeof toSummary>;

export async function rateNumber() {
  const rate = await getCurrentRate();
  return toNumber(rate?.cdfPerUsd);
}

export async function listProducts(opts: { categorySlug?: string; q?: string; featured?: boolean; take?: number }) {
  const where: Prisma.ProductWhereInput = {
    AND: [
      onSale,
      opts.featured ? { featured: true } : {},
      opts.categorySlug
        ? { OR: [{ category: { slug: opts.categorySlug } }, { category: { parent: { slug: opts.categorySlug } } }] }
        : {},
      opts.q
        ? {
            OR: [
              { title: { contains: opts.q, mode: 'insensitive' } },
              { brand: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  };
  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
    take: Math.min(Math.max(opts.take ?? 40, 1), 100),
    select: summarySelect,
  });
  return rows.map(toSummary);
}

export async function listCategories() {
  const all = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { nameFr: 'asc' }],
    select: { id: true, slug: true, nameFr: true, nameEn: true, nameLn: true, nameSw: true, icon: true, parentId: true },
  });
  const shape = (c: (typeof all)[number]) => ({
    id: c.id,
    slug: c.slug,
    nameFr: c.nameFr,
    nameEn: c.nameEn,
    nameLn: c.nameLn,
    nameSw: c.nameSw,
    icon: c.icon,
  });
  return all
    .filter((c) => !c.parentId)
    .map((top) => ({ ...shape(top), children: all.filter((c) => c.parentId === top.id).map(shape) }));
}

export async function getProductBySlug(slug: string) {
  const p = await prisma.product.findFirst({
    where: { AND: [onSale, { slug }] },
    select: {
      id: true,
      slug: true,
      title: true,
      brand: true,
      summary: true,
      description: true,
      images: true,
      videoUrl: true,
      specs: true,
      warrantyMonths: true,
      installAvailable: true,
      installPriceUsd: true,
      instalmentsAllowed: true,
      bigItem: true,
      category: { select: { slug: true, nameFr: true } },
      variants: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: { id: true, label: true, priceUsd: true, compareAtUsd: true, stock: true },
      },
    },
  });
  if (!p) return null;
  return {
    ...p,
    installPriceUsd: toNumber(p.installPriceUsd),
    specs: Array.isArray(p.specs) ? p.specs : [],
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      priceUsd: toNumber(v.priceUsd) ?? 0,
      compareAtUsd: toNumber(v.compareAtUsd),
      // Shoppers see "in stock / only N left", never the exact count above 5.
      inStock: v.stock > 0,
      fewLeft: v.stock > 0 && v.stock <= 5 ? v.stock : null,
    })),
  };
}
