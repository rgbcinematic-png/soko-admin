/**
 * Sets a new password for an admin account, typed in the terminal (hidden, never saved in a file).
 *
 *   npm run reset-password                 (the account in SEED_ADMIN_EMAIL in .env)
 *   node scripts/reset-password.ts you@example.com
 *
 * Uses the database in .env — the LIVE one. Changes only that account's password.
 */
import { createInterface } from 'node:readline';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

process.loadEnvFile?.('.env');
const prisma = new PrismaClient();

/** Asks a question without showing what is typed. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let asked = false;
    out._writeToOutput = (s: string) => {
      if (!asked) {
        out.output.write(s);
        asked = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const email = (process.argv[2] ?? process.env.SEED_ADMIN_EMAIL)?.trim().toLowerCase();
  if (!email) throw new Error('Give the account email: node scripts/reset-password.ts you@example.com');
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } });
  if (!user) throw new Error(`No admin account with the email ${email}.`);

  console.log(`Account: ${email} — ${user.name} (${user.role}).`);
  console.log('Type the new password and press Enter. Nothing shows while you type: that is normal.');
  const password = await askHidden('New password (at least 12 characters): ');
  if (password.length < 12) throw new Error('Too short: use at least 12 characters. Nothing was changed.');
  const again = await askHidden('Type it again: ');
  if (again !== password) throw new Error('The two passwords are different. Nothing was changed.');

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12), isActive: true },
  });
  console.log('Done. Sign in at /login with this email and the new password.');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
