/**
 * Read-only check: is there an admin account, and did the seed finish?
 *
 *   node scripts/check-admin.ts
 *
 * Changes nothing. Emails are partly hidden in the output.
 */
import { PrismaClient } from '@prisma/client';

process.loadEnvFile?.('.env');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, isActive: true, lastLoginAt: true, passwordHash: true },
  });
  console.log(`Admin accounts found: ${users.length}`);
  for (const u of users) {
    console.log({
      email: u.email.replace(/^(.{2}).*@/, '$1***@'),
      role: u.role,
      active: u.isActive,
      everLoggedIn: Boolean(u.lastLoginAt),
      passwordSaved: u.passwordHash.startsWith('$2'),
    });
  }
  const envEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  console.log('Email in .env matches an account:', users.some((u) => u.email === envEmail));
  console.log('Categories:', await prisma.category.count());
  console.log('Exchange rates:', await prisma.exchangeRate.count());
}

main()
  .catch((e) => { console.error('Could not read the database:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
