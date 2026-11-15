import type { City, Market } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { marketClosedResponse, shopperMarket } from '@/lib/markets';

/** Apps older than cities send no city: they shop in Kinshasa. */
export const DEFAULT_CITY = 'kinshasa';

/** "Lubumbashi" / " LUBUMBASHI " → "lubumbashi". Anything that is not a plain id is ignored. */
export function cityIdFrom(raw: string | null | undefined): string | null {
  const id = raw?.trim().toLowerCase();
  return id && /^[a-z][a-z-]{1,39}$/.test(id) ? id : null;
}

/**
 * The open city a shopper buys in, inside their market.
 * No city given: the market's first open city (Kinshasa for RD Congo). A closed or unknown city: null.
 */
export async function shopperCity(raw: string | null | undefined, marketId: string): Promise<City | null> {
  const id = cityIdFrom(raw);
  if (raw && !id) return null;
  return prisma.city.findFirst({
    where: { marketId, isActive: true, ...(id ? { id } : {}) },
    orderBy: { position: 'asc' },
  });
}

export const CITY_CLOSED = 'Soko ne livre pas encore dans cette ville. Choisissez-en une autre.';

/**
 * Where a shopper's request is for: ?market= and ?city=. Old apps send neither and get RD Congo, Kinshasa.
 * Returns a 409 response instead when the market or city is closed, so the app asks again.
 */
export async function shopperPlace(
  marketRaw: string | null | undefined,
  cityRaw: string | null | undefined,
  headers: HeadersInit,
): Promise<{ market: Market; city: City } | Response> {
  const market = await shopperMarket(marketRaw);
  if (!market) return marketClosedResponse(headers);
  const city = await shopperCity(cityRaw, market.id);
  if (!city) return Response.json({ error: CITY_CLOSED, code: 'CITY_CLOSED' }, { status: 409, headers });
  return { market, city };
}

/** The open cities of a market, for the app's "Where should we deliver?" list. */
export async function openCities(marketId: string) {
  return prisma.city.findMany({
    where: { marketId, isActive: true },
    orderBy: { position: 'asc' },
    select: { id: true, name: true },
  });
}

/** Every city, open or not, for the admin. */
export async function allCities() {
  return prisma.city.findMany({ orderBy: [{ marketId: 'asc' }, { position: 'asc' }] });
}

/** The city in an admin page's ?city=, or the first one. */
export async function pickCity(raw: string | undefined) {
  const cities = await allCities();
  const city = cities.find((c) => c.id === cityIdFrom(raw)) ?? cities[0];
  return { cities, city };
}

export type Readiness = {
  /** Delivery types with a saved price and switched on. */
  deliveryTypes: number;
  /** Communes where home delivery is offered. */
  servedCommunes: number;
  /** Pickup points shown in the app. */
  pickupPoints: number;
  /** Products on sale here with a price and at least one in stock. */
  productsInStock: number;
  /** What still has to be done before shoppers can use this city; empty when it can open. */
  missing: string[];
};

/** Whether a city has what shoppers need, so it is never opened empty. */
export async function cityReadiness(cityId: string): Promise<Readiness> {
  const [options, servedCommunes, pickupPoints, productsInStock] = await Promise.all([
    prisma.deliveryOption.findMany({ where: { cityId, isActive: true }, select: { method: true } }),
    prisma.communeSetting.count({ where: { cityId, isServed: true } }),
    prisma.pickupPoint.count({ where: { cityId, isActive: true } }),
    prisma.product.count({
      where: {
        status: 'ACTIVE',
        variants: { some: { isActive: true, offers: { some: { cityId, priceUsd: { not: null }, stock: { gt: 0 } } } } },
      },
    }),
  ]);
  const home = options.some((o) => o.method !== 'PICKUP');
  const pickup = options.some((o) => o.method === 'PICKUP');
  const missing: string[] = [];
  if (options.length === 0) missing.push('Save delivery prices for this city on the Delivery page.');
  else if (!(home && servedCommunes > 0) && !(pickup && pickupPoints > 0)) {
    missing.push(
      home
        ? 'Tick at least one commune for home delivery, or add a pickup point.'
        : 'Add a pickup point in this city, or switch on a home delivery type.',
    );
  }
  if (productsInStock === 0) missing.push('Give at least one product a price and stock in this city.');
  return { deliveryTypes: options.length, servedCommunes, pickupPoints, productsInStock, missing };
}
