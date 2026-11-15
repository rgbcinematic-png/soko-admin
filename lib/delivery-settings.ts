import { prisma } from '@/lib/prisma';
import { DELIVERY_METHODS, type DeliveryMethodId } from '@/lib/delivery-fees';

/** One delivery choice in one city, with the price and on/off switch saved in the admin. */
export type DeliveryChoice = {
  id: DeliveryMethodId;
  label: string;
  detail: string;
  feeUsd: number;
  toHome: boolean;
  forBigItems: boolean;
  isActive: boolean;
  /** False until a price is saved for this city; an unsaved type is never offered. */
  saved: boolean;
};

export type CommuneChoice = { name: string; isServed: boolean; surchargeUsd: number };

/** A city's delivery prices and communes, as set on the admin's Delivery page. */
export async function getDeliverySettings(
  cityId: string,
): Promise<{ methods: DeliveryChoice[]; communes: CommuneChoice[] }> {
  const [options, communes] = await Promise.all([
    prisma.deliveryOption.findMany({ where: { cityId } }),
    prisma.communeSetting.findMany({ where: { cityId }, orderBy: { name: 'asc' } }),
  ]);
  const byMethod = new Map(options.map((o) => [o.method as string, o]));

  return {
    methods: DELIVERY_METHODS.map((m) => {
      const saved = byMethod.get(m.id);
      return {
        id: m.id,
        label: m.label,
        detail: m.detail,
        toHome: m.toHome,
        forBigItems: m.forBigItems,
        feeUsd: saved ? Number(saved.feeUsd) : 0,
        isActive: saved ? saved.isActive : false,
        saved: Boolean(saved),
      };
    }),
    communes: communes.map((c) => ({ name: c.name, isServed: c.isServed, surchargeUsd: Number(c.surchargeUsd) })),
  };
}

/** The choices a basket can use: big items go by van or pickup only; switched-off ones are left out. */
export function choicesFor(methods: DeliveryChoice[], hasBigItem: boolean) {
  return methods.filter((m) => m.isActive && (hasBigItem ? m.forBigItems : m.id !== 'BIG_ITEM'));
}
