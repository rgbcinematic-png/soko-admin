import type { Market } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { offeredMethods } from '@/lib/payments';

/** Requests without a market come from app versions released before markets existed: they are RD Congo. */
export const DEFAULT_MARKET = 'CD';

/** "cd", " CD " → "CD"; anything that is not two letters → the default market. */
export function marketIdFrom(raw: string | null | undefined): string {
  const id = raw?.trim().toUpperCase();
  return id && /^[A-Z]{2}$/.test(id) ? id : DEFAULT_MARKET;
}

/**
 * Markets the shop code can serve. Europe joins in Level 2, once it has EUR prices,
 * European delivery and card payments, so switching it on in the database early
 * cannot show shoppers Kinshasa prices and communes.
 */
export const READY_MARKETS: readonly string[] = ['CD'];

const isOpen = (m: Market | null): m is Market => !!m && m.isActive && READY_MARKETS.includes(m.id);

/** The market a shopper request is for, or null when it doesn't exist or is not open. */
export async function shopperMarket(raw: string | null | undefined): Promise<Market | null> {
  const market = await prisma.market.findUnique({ where: { id: marketIdFrom(raw) } });
  return isOpen(market) ? market : null;
}

/** What the app is told about a market. */
export function publicMarket(m: Market) {
  return {
    id: m.id,
    name: m.name,
    currency: m.currency,
    countries: m.countries,
    paymentMethods: offeredMethods(m.paymentMethods),
  };
}

export async function listShopperMarkets() {
  const rows = await prisma.market.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } });
  return rows.filter(isOpen).map(publicMarket);
}

/** The reply for a market that is unknown or not open yet. */
export const MARKET_CLOSED = 'Soko ne livre pas encore dans cette région.';

/** 409 so the app can tell "this region is closed" apart from "not found" or "server down". */
export function marketClosedResponse(headers: HeadersInit) {
  return Response.json({ error: MARKET_CLOSED, code: 'MARKET_CLOSED' }, { status: 409, headers });
}
