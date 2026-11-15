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

/** A variant sold in this city: switched on and with a price there. */
const soldIn = (cityId: string): Prisma.ProductVariantWhereInput => ({
  isActive: true,
  offers: { some: { cityId, priceUsd: { not: null } } },
});

/** Products shoppers in this city can see. */
export const onSaleIn = (cityId: string): Prisma.ProductWhereInput => ({
  status: 'ACTIVE',
  variants: { some: soldIn(cityId) },
});

const summarySelect = (cityId: string) =>
  ({
    id: true,
    slug: true,
    title: true,
    brand: true,
    images: true,
    installAvailable: true,
    cities: { where: { cityId }, select: { installPriceUsd: true } },
    instalmentsAllowed: true,
    bigItem: true,
    variants: {
      where: soldIn(cityId),
      select: { offers: { where: { cityId }, select: { priceUsd: true, compareAtUsd: true, stock: true } } },
    },
  }) satisfies Prisma.ProductSelect;

type SummaryRow = Prisma.ProductGetPayload<{ select: ReturnType<typeof summarySelect> }>;

/** A product card in one city: cheapest price there, its "was" price, and whether any stock is left there. */
function toSummary(p: SummaryRow) {
  const offers = p.variants.flatMap((v) => v.offers);
  const cheapest = [...offers].sort((a, b) => (toNumber(a.priceUsd) ?? 0) - (toNumber(b.priceUsd) ?? 0))[0];
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    image: p.images[0] ?? null,
    priceUsd: toNumber(cheapest?.priceUsd) ?? 0,
    compareAtUsd: toNumber(cheapest?.compareAtUsd),
    hasOptions: p.variants.length > 1,
    inStock: offers.some((o) => o.stock > 0),
    installAvailable: p.installAvailable && p.cities[0]?.installPriceUsd != null,
    instalmentsAllowed: p.instalmentsAllowed,
    bigItem: p.bigItem,
  };
}
export type ProductSummary = ReturnType<typeof toSummary>;

export async function rateNumber() {
  const rate = await getCurrentRate();
  return toNumber(rate?.cdfPerUsd);
}

export async function listProducts(opts: {
  cityId: string;
  categorySlug?: string;
  q?: string;
  featured?: boolean;
  take?: number;
}) {
  const where: Prisma.ProductWhereInput = {
    AND: [
      onSaleIn(opts.cityId),
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
    select: summarySelect(opts.cityId),
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

export async function getProductBySlug(slug: string, cityId: string) {
  const p = await prisma.product.findFirst({
    where: { AND: [onSaleIn(cityId), { slug }] },
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
      cities: { where: { cityId }, select: { installPriceUsd: true } },
      instalmentsAllowed: true,
      bigItem: true,
      category: { select: { slug: true, nameFr: true } },
      variants: {
        where: soldIn(cityId),
        orderBy: { position: 'asc' },
        select: {
          id: true,
          label: true,
          offers: { where: { cityId }, select: { priceUsd: true, compareAtUsd: true, stock: true } },
        },
      },
    },
  });
  if (!p) return null;
  const { cities, ...rest } = p;
  // Installation is offered in this city only when it has a price here.
  const installPriceUsd = p.installAvailable ? toNumber(cities[0]?.installPriceUsd) : null;
  return {
    ...rest,
    installAvailable: installPriceUsd !== null,
    installPriceUsd,
    specs: Array.isArray(p.specs) ? p.specs : [],
    variants: p.variants.map((v) => {
      const offer = v.offers[0];
      const stock = offer?.stock ?? 0;
      return {
        id: v.id,
        label: v.label,
        priceUsd: toNumber(offer?.priceUsd) ?? 0,
        compareAtUsd: toNumber(offer?.compareAtUsd),
        // Shoppers see "in stock / only N left", never the exact count above 5.
        inStock: stock > 0,
        fewLeft: stock > 0 && stock <= 5 ? stock : null,
      };
    }),
  };
}
