/**
 * The delivery types Soko offers. Their prices are set per city on the admin's Delivery page;
 * a city has no delivery until its prices are saved there.
 */
export const DELIVERY_METHODS = [
  {
    id: 'EXPRESS_MOTO',
    label: 'Express moto',
    detail: 'Aujourd’hui si commandé avant 14 h · petits articles',
    toHome: true,
    forBigItems: false,
  },
  {
    id: 'STANDARD',
    label: 'Livraison standard',
    detail: 'Demain, au créneau de votre choix',
    toHome: true,
    forBigItems: false,
  },
  {
    id: 'BIG_ITEM',
    label: 'Gros article (camionnette)',
    detail: '1 à 3 jours · frigos, TV, climatiseurs',
    toHome: true,
    forBigItems: true,
  },
  {
    id: 'PICKUP',
    label: 'Retrait au point relais',
    detail: 'Prêt en quelques heures · gratuit',
    toHome: false,
    forBigItems: true,
  },
] as const;

export type DeliveryMethodId = (typeof DELIVERY_METHODS)[number]['id'];

/** A basket with a big item can only go by van or be collected. */
export function methodsFor(hasBigItem: boolean) {
  return DELIVERY_METHODS.filter((m) => (hasBigItem ? m.forBigItems : m.id !== 'BIG_ITEM'));
}

/** Communes are stored per city in the database (CommuneSetting). */

export const TIME_SLOTS = ['Matin (8 h – 12 h)', 'Après-midi (12 h – 17 h)', 'Soir (17 h – 20 h)'] as const;
