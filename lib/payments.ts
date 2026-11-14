import type { PaymentMethod } from '@prisma/client';

/**
 * Payment methods the shop knows about. A market switches methods on (Market.paymentMethods),
 * but a method is only offered to shoppers once its provider is connected here.
 *
 * Level 1 (DRC) connects Mobile Money; Level 2 (Europe) connects cards.
 */
export const CONNECTED_METHODS: readonly PaymentMethod[] = ['CASH_ON_DELIVERY'];

/** Names for the admin. The app has its own translated names. */
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CASH_ON_DELIVERY: 'Cash on delivery',
  MPESA: 'M-Pesa',
  AIRTEL_MONEY: 'Airtel Money',
  ORANGE_MONEY: 'Orange Money',
  CARD: 'Card',
};

/** Paid by the customer at the door or the relay point, so no online payment step. */
export const isPaidOnDelivery = (m: PaymentMethod) => m === 'CASH_ON_DELIVERY';

/** The methods a shopper may choose in a market: switched on there and connected. */
export function offeredMethods(marketMethods: readonly PaymentMethod[]): PaymentMethod[] {
  return marketMethods.filter((m) => CONNECTED_METHODS.includes(m));
}
