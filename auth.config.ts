import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe half of the auth setup.
 *
 * The proxy runs on the Edge runtime, where Prisma and bcrypt cannot run —
 * so the providers live in `auth.ts` (Node) and only this config, which does
 * nothing but read the JWT, is used by `proxy.ts`.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8, // 8 hours — an admin session, not a consumer one
  },
  trustHost: true,
  providers: [], // filled in by auth.ts
  callbacks: {
    // Attach role + id to the token at sign-in, then mirror onto the session.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? 'STAFF';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'ADMIN' | 'STAFF';
      }
      return session;
    },
    authorized({ auth, request }) {
      const signedIn = !!auth?.user;
      const onAdmin = request.nextUrl.pathname.startsWith('/admin');
      if (onAdmin) return signedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
