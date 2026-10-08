import type { DeliveryMethod, OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** SK-2610-0001: order number within the month. */
export async function nextOrderRef(): Promise<string> {
  const now = new Date();
  const yymm = String(now.getUTCFullYear()).slice(2) + String(now.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `SK-${yymm}-`;
  const last = await prisma.order.findFirst({
    where: { ref: { startsWith: prefix } },
    orderBy: { ref: 'desc' },
    select: { ref: true },
  });
  const n = last ? Number(last.ref.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(4, '0');
}

/** +243 812 345 678, 0812345678, 812345678 → +243812345678. Other countries keep their +code. */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[^\d+]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) {
    if (s.startsWith('243')) s = '+' + s;
    else if (s.startsWith('0') && s.length === 10) s = '+243' + s.slice(1);
    else if (s.length === 9) s = '+243' + s;
    else return null;
  }
  return /^\+\d{8,15}$/.test(s) ? s : null;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'New — to confirm',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  READY_FOR_PICKUP: 'Ready for pickup',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export const METHOD_LABEL: Record<DeliveryMethod, string> = {
  EXPRESS_MOTO: 'Express moto',
  STANDARD: 'Standard delivery',
  BIG_ITEM: 'Big item (van)',
  PICKUP: 'Pickup point',
  PROVINCE: 'Province',
};

/** While an order is in one of these, its items have been taken out of stock. */
export const STOCK_TAKEN: OrderStatus[] = ['CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED'];

/** Which buttons the admin sees, in order. */
export function nextSteps(status: OrderStatus, method: DeliveryMethod): OrderStatus[] {
  switch (status) {
    case 'PENDING':
      return ['CONFIRMED', 'CANCELLED'];
    case 'CONFIRMED':
      return ['PACKED', 'CANCELLED'];
    case 'PACKED':
      return [method === 'PICKUP' ? 'READY_FOR_PICKUP' : 'OUT_FOR_DELIVERY', 'CANCELLED'];
    case 'OUT_FOR_DELIVERY':
      return ['DELIVERED', 'RETURNED'];
    case 'READY_FOR_PICKUP':
      return ['DELIVERED', 'CANCELLED'];
    case 'DELIVERED':
      return ['RETURNED'];
    default:
      return [];
  }
}

/** Badge colours for each status in the admin. */
export const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: 'bg-[#FFF3C4] text-[#7A5A00]',
  CONFIRMED: 'bg-[#DCEBFA] text-[#0A2540]',
  PACKED: 'bg-[#DCEBFA] text-[#0A2540]',
  OUT_FOR_DELIVERY: 'bg-[#FFE9D6] text-[#B33A00]',
  READY_FOR_PICKUP: 'bg-[#FFE9D6] text-[#B33A00]',
  DELIVERED: 'bg-[#E7F6EC] text-[#15803D]',
  CANCELLED: 'bg-[#EEF1F4] text-[#5B6B7C]',
  RETURNED: 'bg-[#FDE8EC] text-[#BE123C]',
};
