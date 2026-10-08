import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import { hitRateLimit } from '@/lib/rate-limit';

const Credentials_ = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = Credentials_.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        // Throttle by email so a stolen list can't be brute-forced quickly.
        if (!hitRateLimit(`login:${email}`, 8, 10 * 60_000)) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        // Always run a hash comparison, even when the user does not exist,
        // so response time does not reveal which emails are registered.
        const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu';
        const ok = await bcrypt.compare(parsed.data.password, hash);

        if (!user || !user.isActive || !ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
