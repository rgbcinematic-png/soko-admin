/**
 * Delivery options shown at checkout.
 *
 * ⚠️ THE FEES BELOW ARE PLACEHOLDERS from the product plan — change them to
 * your real prices before launch. Amounts are in US dollars.
 */
export const DELIVERY_METHODS = [
  {
    id: 'EXPRESS_MOTO',
    label: 'Express moto',
    detail: 'Aujourd’hui si commandé avant 14 h · petits articles',
    feeUsd: 5,
    toHome: true,
    forBigItems: false,
  },
  {
    id: 'STANDARD',
    label: 'Livraison standard',
    detail: 'Demain, au créneau de votre choix',
    feeUsd: 3,
    toHome: true,
    forBigItems: false,
  },
  {
    id: 'BIG_ITEM',
    label: 'Gros article (camionnette)',
    detail: '1 à 3 jours · frigos, TV, climatiseurs',
    feeUsd: 15,
    toHome: true,
    forBigItems: true,
  },
  {
    id: 'PICKUP',
    label: 'Retrait au point relais',
    detail: 'Prêt en quelques heures · gratuit',
    feeUsd: 0,
    toHome: false,
    forBigItems: true,
  },
] as const;

export type DeliveryMethodId = (typeof DELIVERY_METHODS)[number]['id'];

/** A basket with a big item can only go by van or be collected. */
export function methodsFor(hasBigItem: boolean) {
  return DELIVERY_METHODS.filter((m) => (hasBigItem ? m.forBigItems : m.id !== 'BIG_ITEM'));
}

/** The 24 communes of Kinshasa. */
export const KINSHASA_COMMUNES = [
  'Bandalungwa', 'Barumbu', 'Bumbu', 'Gombe', 'Kalamu', 'Kasa-Vubu', 'Kimbanseke', 'Kinshasa',
  'Kintambo', 'Kisenso', 'Lemba', 'Limete', 'Lingwala', 'Makala', 'Maluku', 'Masina',
  'Matete', 'Mont-Ngafula', 'Ndjili', 'Ngaba', 'Ngaliema', 'Ngiri-Ngiri', 'Nsele', 'Selembao',
] as const;

export const TIME_SLOTS = ['Matin (8 h – 12 h)', 'Après-midi (12 h – 17 h)', 'Soir (17 h – 20 h)'] as const;
