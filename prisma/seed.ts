/**
 * Creates your admin login, the starting categories and the first exchange rate.
 *
 *   node prisma/seed.ts
 *
 * Reads SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_PASSWORD and SEED_CDF_RATE
 * from .env. Safe to run again: it updates rather than duplicates.
 * Delete SEED_ADMIN_PASSWORD from .env once you have signed in.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

process.loadEnvFile?.('.env');
const prisma = new PrismaClient();

// The six categories from the app design, plus the appliance sub-categories.
const CATEGORIES = [
  { slug: 'telephones', nameFr: 'Téléphones', nameEn: 'Phones', icon: 'smartphone' },
  { slug: 'energie', nameFr: 'Énergie', nameEn: 'Power & energy', icon: 'zap' },
  { slug: 'electronique', nameFr: 'Électronique', nameEn: 'Electronics', icon: 'tv' },
  { slug: 'electromenager', nameFr: 'Électroménager', nameEn: 'Appliances', icon: 'refrigerator' },
  { slug: 'mode', nameFr: 'Mode', nameEn: 'Fashion', icon: 'shirt' },
  { slug: 'maison', nameFr: 'Maison', nameEn: 'Home', icon: 'house' },
];
const APPLIANCE_SUBS = [
  { slug: 'refrigerateurs', nameFr: 'Réfrigérateurs', nameEn: 'Fridges' },
  { slug: 'congelateurs', nameFr: 'Congélateurs', nameEn: 'Freezers' },
  { slug: 'climatiseurs', nameFr: 'Climatiseurs', nameEn: 'Air conditioners' },
  { slug: 'ventilateurs', nameFr: 'Ventilateurs', nameEn: 'Fans' },
  { slug: 'cuisine', nameFr: 'Cuisine', nameEn: 'Kitchen' },
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.SEED_ADMIN_NAME?.trim() || 'Administrator';
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (password) {
    if (!email) throw new Error('Set SEED_ADMIN_EMAIL in .env first.');
    if (password.length < 12) throw new Error('Use an admin password of at least 12 characters.');
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role: 'ADMIN', isActive: true },
      create: { email, name, passwordHash, role: 'ADMIN' },
    });
    console.log(`Admin ready: ${email}`);
  } else if ((await prisma.user.count()) === 0) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env before seeding.');
  } else {
    console.log('No SEED_ADMIN_PASSWORD set — left the existing admin alone.');
  }

  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameFr: c.nameFr, nameEn: c.nameEn, icon: c.icon, position: i },
      create: { ...c, position: i },
    });
  }
  const appliances = await prisma.category.findUniqueOrThrow({ where: { slug: 'electromenager' } });
  for (const [i, c] of APPLIANCE_SUBS.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameFr: c.nameFr, nameEn: c.nameEn, position: i, parentId: appliances.id },
      create: { ...c, position: i, parentId: appliances.id },
    });
  }
  console.log(`Categories ready: ${CATEGORIES.length} main, ${APPLIANCE_SUBS.length} appliance sub-categories`);

  if ((await prisma.exchangeRate.count()) === 0) {
    const rate = Number(process.env.SEED_CDF_RATE);
    if (!rate || rate < 100) throw new Error("Set SEED_CDF_RATE in .env to today's Congolese francs per US dollar.");
    await prisma.exchangeRate.create({ data: { cdfPerUsd: rate } });
    console.log(`Exchange rate set: ${rate} FC = $1`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
