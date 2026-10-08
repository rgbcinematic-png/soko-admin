import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hitRateLimit } from '@/lib/rate-limit';
import { DELIVERY_METHODS, KINSHASA_COMMUNES, methodsFor, TIME_SLOTS } from '@/lib/delivery-fees';
import { nextOrderRef, normalizePhone } from '@/lib/orders';
import { rateNumber, SHOPPER_HEADERS } from '@/lib/storefront';

const Body = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Entrez votre nom.').max(80),
    phone: z.string().trim().min(6, 'Entrez votre numéro de téléphone.').max(24),
  }),
  recipient: z
    .object({ name: z.string().trim().max(80).optional(), phone: z.string().trim().max(24).optional() })
    .optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1).max(40),
        quantity: z.number().int().min(1).max(20),
        withInstall: z.boolean().default(false),
      }),
    )
    .min(1, 'Votre panier est vide.')
    .max(30),
  delivery: z.object({
    method: z.enum(['EXPRESS_MOTO', 'STANDARD', 'BIG_ITEM', 'PICKUP']),
    commune: z.string().trim().max(40).optional(),
    quartier: z.string().trim().max(80).optional(),
    avenue: z.string().trim().max(120).optional(),
    landmark: z.string().trim().max(200).optional(),
    instructions: z.string().trim().max(400).optional(),
    timeSlot: z.string().trim().max(40).optional(),
    pickupPointId: z.string().max(40).optional(),
  }),
  paymentMethod: z.literal('CASH_ON_DELIVERY'),
  note: z.string().trim().max(500).optional(),
});

const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: SHOPPER_HEADERS });
const cents = (n: number) => Math.round(n * 100);

/** POST /api/orders — places an order from the app. Cash on delivery only for now. */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!hitRateLimit(`order:${ip}`, 10, 10 * 60_000)) {
    return fail('Trop de commandes en peu de temps. Réessayez dans quelques minutes.', 429);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail('Commande illisible.');
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Vérifiez votre commande.');
  const d = parsed.data;

  const phone = normalizePhone(d.customer.phone);
  if (!phone) return fail('Numéro de téléphone invalide. Exemple : 0812345678 ou +243812345678.');
  const recipientPhone = d.recipient?.phone ? normalizePhone(d.recipient.phone) : null;
  if (d.recipient?.phone && !recipientPhone) return fail('Le numéro du destinataire est invalide.');

  // Merge repeated lines of the same variant.
  const lines = new Map<string, { variantId: string; quantity: number; withInstall: boolean }>();
  for (const it of d.items) {
    const key = `${it.variantId}:${it.withInstall}`;
    const prev = lines.get(key);
    lines.set(key, { ...it, quantity: (prev?.quantity ?? 0) + it.quantity });
  }

  try {
    // Prices and stock come from the database, never from the phone.
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: [...lines.values()].map((l) => l.variantId) }, isActive: true, product: { status: 'ACTIVE' } },
      include: { product: { select: { title: true, bigItem: true, installAvailable: true, installPriceUsd: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    let subtotal = 0;
    let install = 0;
    let hasBigItem = false;
    const itemRows: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    for (const line of lines.values()) {
      const v = byId.get(line.variantId);
      if (!v) return fail('Un article de votre panier n’est plus disponible. Retirez-le et réessayez.');
      const wanted = [...lines.values()].filter((l) => l.variantId === v.id).reduce((s, l) => s + l.quantity, 0);
      if (wanted > v.stock) {
        return fail(
          v.stock > 0
            ? `Plus que ${v.stock} en stock pour « ${v.product.title} (${v.label}) ».`
            : `« ${v.product.title} (${v.label}) » est en rupture de stock.`,
        );
      }
      const unit = cents(Number(v.priceUsd));
      const withInstall = line.withInstall && v.product.installAvailable && v.product.installPriceUsd !== null;
      subtotal += unit * line.quantity;
      if (withInstall) install += cents(Number(v.product.installPriceUsd)) * line.quantity;
      if (v.product.bigItem) hasBigItem = true;
      itemRows.push({
        variant: { connect: { id: v.id } },
        title: v.product.title,
        variantLabel: v.label,
        unitPriceUsd: unit / 100,
        quantity: line.quantity,
        withInstall,
        lineTotalUsd: (unit * line.quantity) / 100,
      });
    }

    const method = DELIVERY_METHODS.find((m) => m.id === d.delivery.method)!;
    if (!methodsFor(hasBigItem).some((m) => m.id === method.id)) {
      return fail(
        hasBigItem
          ? 'Votre panier contient un gros article : choisissez la camionnette ou le retrait.'
          : 'Ce mode de livraison n’est pas proposé pour ce panier.',
      );
    }

    let pickupPointId: string | null = null;
    let address: Prisma.InputJsonValue | undefined;
    let deliveryPlaceId: string | null = null;
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: { name: d.customer.name },
      create: { phone, name: d.customer.name },
    });
    if (customer.isBlocked) return fail('Impossible de passer commande. Contactez-nous.', 403);

    if (method.toHome) {
      const commune = KINSHASA_COMMUNES.find((c) => c === d.delivery.commune);
      if (!commune) return fail('Choisissez votre commune.');
      if (!d.delivery.landmark || d.delivery.landmark.length < 3) {
        return fail('Indiquez un point de repère (ex. près de l’église, après le marché).');
      }
      if (d.delivery.timeSlot && !TIME_SLOTS.some((t) => t === d.delivery.timeSlot)) return fail('Créneau invalide.');
      const place = {
        commune,
        quartier: d.delivery.quartier || null,
        avenue: d.delivery.avenue || null,
        landmark: d.delivery.landmark,
        instructions: d.delivery.instructions || null,
      };
      address = { city: 'Kinshasa', ...place };
      const saved =
        (await prisma.deliveryPlace.findFirst({
          where: { customerId: customer.id, commune, landmark: place.landmark },
          select: { id: true },
        })) ??
        (await prisma.deliveryPlace.create({ data: { customerId: customer.id, ...place }, select: { id: true } }));
      deliveryPlaceId = saved.id;
    } else {
      const point = d.delivery.pickupPointId
        ? await prisma.pickupPoint.findFirst({ where: { id: d.delivery.pickupPointId, isActive: true } })
        : null;
      if (!point) return fail('Choisissez un point relais.');
      pickupPointId = point.id;
    }

    const fee = cents(method.feeUsd);
    const total = subtotal + install + fee;
    const rate = (await rateNumber()) ?? 0;

    // Two orders in the same second could pick the same number; try again once.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const order = await prisma.order.create({
          data: {
            ref: await nextOrderRef(),
            customer: { connect: { id: customer.id } },
            recipientName: d.recipient?.name || null,
            recipientPhone,
            deliveryMethod: method.id,
            deliveryPlace: deliveryPlaceId ? { connect: { id: deliveryPlaceId } } : undefined,
            pickupPoint: pickupPointId ? { connect: { id: pickupPointId } } : undefined,
            addressSnapshot: address,
            timeSlot: method.toHome ? d.delivery.timeSlot || null : null,
            deliveryCode: String(randomInt(1000, 10000)),
            subtotalUsd: subtotal / 100,
            deliveryUsd: fee / 100,
            installUsd: install / 100,
            totalUsd: total / 100,
            cdfPerUsd: rate,
            paymentMethod: 'CASH_ON_DELIVERY',
            customerNote: d.note || null,
            items: { create: itemRows },
            events: { create: { status: 'PENDING', note: 'Commande passée dans l’app' } },
          },
          select: { ref: true, deliveryCode: true, totalUsd: true, cdfPerUsd: true },
        });
        return Response.json(
          {
            ref: order.ref,
            deliveryCode: order.deliveryCode,
            totalUsd: Number(order.totalUsd),
            totalCdf: Math.round(Number(order.totalUsd) * Number(order.cdfPerUsd)),
          },
          { status: 201, headers: SHOPPER_HEADERS },
        );
      } catch (e) {
        if (attempt === 0 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    return fail('La commande n’a pas pu être enregistrée. Réessayez.', 500);
  } catch (e) {
    console.error('orders POST failed', e);
    return fail('La commande n’a pas pu être enregistrée. Réessayez.', 500);
  }
}
