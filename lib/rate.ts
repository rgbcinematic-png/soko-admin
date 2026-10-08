import { prisma } from '@/lib/prisma';

/** The newest exchange rate is the one in use. Server code only. */
export async function getCurrentRate() {
  return prisma.exchangeRate.findFirst({
    orderBy: { effectiveFrom: 'desc' },
    select: { cdfPerUsd: true, effectiveFrom: true },
  });
}
