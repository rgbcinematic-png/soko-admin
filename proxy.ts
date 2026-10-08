import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Edge-safe: authConfig has no providers, so no Prisma or bcrypt is bundled here.
export const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  // Guard the admin area; skip static assets and the auth endpoints themselves.
  matcher: ['/admin/:path*'],
};
