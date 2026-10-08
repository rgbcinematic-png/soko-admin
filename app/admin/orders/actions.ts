'use server';

import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { nextSteps, STATUS_LABEL, STOCK_TAKEN } from '@/lib/orders';

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authorised');
  return session.user;
}

const StatusInput = z.object({
  orderId: z.string().min(1),
  to: z.enum(['PENDING', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED', 'RETURNED']),
  note: z.string().trim().max(300).optional(),
});

class StepError extends Error {}

/**
 * Moves an order to its next step.
 * Confirming takes the items out of stock; cancelling or a return puts them back.
 */
export async function moveOrder(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = StatusInput.safeParse({
    orderId: formData.get('orderId'),
    to: formData.get('to'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return;
  const { orderId, to, note } = parsed.data;
  let message = '';

  try {
    await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (!order) throw new StepError('This order no longer exists.');
        if (!nextSteps(order.status, order.deliveryMethod).includes(to)) {
          throw new StepError(`An order that is "${STATUS_LABEL[order.status]}" cannot go to "${STATUS_LABEL[to]}". Reload the page.`);
        }

        const held = STOCK_TAKEN.includes(order.status);
        const willHold = STOCK_TAKEN.includes(to);

        if (!held && willHold) {
          // Take stock now, and refuse if any line is short.
          for (const item of order.items) {
            const v = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true, label: true } });
            if (!v || v.stock < item.quantity) {
              throw new StepError(`Not enough stock for ${item.title} (${item.variantLabel}): ${v?.stock ?? 0} left, ${item.quantity} ordered.`);
            }
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { decrement: item.quantity } } });
            await tx.stockMovement.create({
              data: { variantId: item.variantId, change: -item.quantity, reason: 'SALE', orderId: order.id, note: order.ref, byId: user.id },
            });
          }
        }
        if (held && !willHold) {
          for (const item of order.items) {
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
            await tx.stockMovement.create({
              data: {
                variantId: item.variantId,
                change: item.quantity,
                reason: 'RETURN',
                orderId: order.id,
                note: `${order.ref} ${to === 'RETURNED' ? 'returned' : 'cancelled'}`,
                byId: user.id,
              },
            });
          }
        }

        const extra: { deliveredAt?: Date; paymentStatus?: 'PAID' | 'REFUNDED' } = {};
        if (to === 'DELIVERED') {
          extra.deliveredAt = new Date();
          if (order.paymentMethod === 'CASH_ON_DELIVERY' && order.paymentStatus !== 'PAID') {
            extra.paymentStatus = 'PAID';
            await tx.payment.create({
              data: { orderId: order.id, method: 'CASH_ON_DELIVERY', state: 'SUCCEEDED', amountUsd: order.totalUsd },
            });
          }
        }
        if (to === 'RETURNED' && order.paymentStatus === 'PAID') extra.paymentStatus = 'REFUNDED';

        await tx.order.update({ where: { id: order.id }, data: { status: to, ...extra } });
        await tx.orderEvent.create({ data: { orderId: order.id, status: to, note: note || null, actorId: user.id } });
      },
      { timeout: 20_000 },
    );
  } catch (e) {
    message = e instanceof StepError ? e.message : 'The order could not be updated. Please try again.';
    if (!(e instanceof StepError)) console.error('moveOrder failed', e);
  }

  if (message) redirect(`/admin/orders/${orderId}?error=${encodeURIComponent(message)}`);
  refresh();
}

/** A private note on the order — never shown to the customer. */
export async function saveOrderNote(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get('orderId') ?? '');
  const note = String(formData.get('internalNote') ?? '').trim().slice(0, 2000);
  if (!id) return;
  await prisma.order.update({ where: { id }, data: { internalNote: note || null } });
  refresh();
}

