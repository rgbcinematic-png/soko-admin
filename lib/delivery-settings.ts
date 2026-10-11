import { prisma } from '@/lib/prisma';
import { DELIVERY_METHODS, KINSHASA_COMMUNES, type DeliveryMethodId } from '@/lib/delivery-fees';

/** One delivery choice with the price and on/off switch saved in the admin. */
export type DeliveryChoice = {
  id: DeliveryMethodId;
  label: string;
  detail: string;
  feeUsd: number;
  toHome: boolean;
  forBigItems: boolean;
  isActive: boolean;
};

export type CommuneChoice = { name: string; isServed: boolean; surchargeUsd: number };

/**
 * Delivery prices and communes as set on the admin's Delivery page.
 * Anything not saved yet uses the defaults in lib/delivery-fees.ts.
 */
export async function getDeliverySettings(): Promise<{ methods: DeliveryChoice[]; communes: CommuneChoice[] }> {
  const [options, communes] = await Promise.all([
    prisma.deliveryOption.findMany(),
    prisma.communeSetting.findMany(),
  ]);
  const byMethod = new Map(options.map((o) => [o.method as string, o]));
  const byCommune = new Map(communes.map((c) => [c.name, c]));

  return {
    methods: DELIVERY_METHODS.map((m) => {
      const saved = byMethod.get(m.id);
      return {
        id: m.id,
        label: m.label,
        detail: m.detail,
        toHome: m.toHome,
        forBigItems: m.forBigItems,
        feeUsd: saved ? Number(saved.feeUsd) : m.feeUsd,
        isActive: saved ? saved.isActive : true,
      };
    }),
    communes: KINSHASA_COMMUNES.map((name) => {
      const saved = byCommune.get(name);
      return {
        name,
        isServed: saved ? saved.isServed : true,
        surchargeUsd: saved ? Number(saved.surchargeUsd) : 0,
      };
    }),
  };
}

/** The choices a basket can use: big items go by van or pickup only; switched-off ones are left out. */
export function choicesFor(methods: DeliveryChoice[], hasBigItem: boolean) {
  return methods.filter((m) => m.isActive && (hasBigItem ? m.forBigItems : m.id !== 'BIG_ITEM'));
}
