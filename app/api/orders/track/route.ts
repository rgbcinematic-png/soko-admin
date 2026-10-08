import { z } from 'zod';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hitRateLimit } from '@/lib/rate-limit';
import { SHOPPER_HEADERS } from '@/lib/storefront';

/** What the shopper sees, in French. */
const STATUS_FR: Record<OrderStatus, string> = {
  PENDING: 'Reçue — nous allons vous appeler',
  CONFIRMED: 'Confirmée',
  PACKED: 'Préparée',
  OUT_FOR_DELIVERY: 'En route',
  READY_FOR_PICKUP: 'Prête au point relais',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  RETURNED: 'Retournée',
};

const Body = z.object({
  orders: z
    .array(z.object({ ref: z.string().min(3).max(30), token: z.string().min(10).max(60) }))
    .min(1)
    .max(30),
});

/**
 * POST /api/orders/track — progress of the orders saved on this phone.
 * An order is only returned when both its number and its secret key match.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!hitRateLimit(`track:${ip}`, 60, 10 * 60_000)) {
    return Response.json({ error: 'Trop de demandes. Réessayez dans quelques minutes.' }, { status: 429, headers: SHOPPER_HEADERS });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: 'Demande illisible.' }, { status: 400, headers: SHOPPER_HEADERS });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: 'Demande invalide.' }, { status: 400, headers: SHOPPER_HEADERS });
  }

  try {
    const found = await prisma.order.findMany({
      where: { OR: parsed.data.orders.map((o) => ({ ref: o.ref, trackingToken: o.token })) },
      orderBy: { createdAt: 'desc' },
      select: {
        ref: true,
        status: true,
        deliveryMethod: true,
        deliveryCode: true,
        totalUsd: true,
        cdfPerUsd: true,
        createdAt: true,
        timeSlot: true,
        addressSnapshot: true,
        pickupPoint: { select: { name: true, commune: true, landmark: true, openingHours: true } },
        items: { select: { title: true, variantLabel: true, quantity: true, lineTotalUsd: true, withInstall: true } },
        events: { orderBy: { createdAt: 'asc' }, select: { status: true, createdAt: true } },
      },
    });

    const orders = found.map((o) => {
      const addr = (o.addressSnapshot ?? {}) as { commune?: string; landmark?: string };
      return {
        ref: o.ref,
        status: o.status,
        statusLabel: STATUS_FR[o.status],
        isPickup: o.deliveryMethod === 'PICKUP',
        deliveryCode: o.deliveryCode,
        totalUsd: Number(o.totalUsd),
        totalCdf: Math.round(Number(o.totalUsd) * Number(o.cdfPerUsd)),
        placedAt: o.createdAt.toISOString(),
        timeSlot: o.timeSlot,
        place: o.pickupPoint
          ? `${o.pickupPoint.name}, ${o.pickupPoint.commune} — ${o.pickupPoint.landmark}`
          : [addr.commune, addr.landmark].filter(Boolean).join(' — '),
        items: o.items.map((i) => ({
          title: i.title,
          variantLabel: i.variantLabel,
          quantity: i.quantity,
          lineTotalUsd: Number(i.lineTotalUsd),
          withInstall: i.withInstall,
        })),
        timeline: o.events.map((e) => ({ status: e.status, label: STATUS_FR[e.status], at: e.createdAt.toISOString() })),
      };
    });
    return Response.json({ orders }, { headers: SHOPPER_HEADERS });
  } catch (e) {
    console.error('orders/track failed', e);
    return Response.json({ error: 'Le suivi est indisponible. Réessayez.' }, { status: 503, headers: SHOPPER_HEADERS });
  }
}
