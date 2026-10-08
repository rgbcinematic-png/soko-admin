import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { getCurrentRate } from '@/lib/rate';
import { cdf } from '@/lib/money';
import { setRate } from './products/actions';

export const metadata: Metadata = {
  title: 'Soko admin',
  robots: { index: false, follow: false },
};

// The frame around every admin page. Anything that reads the login or the
// database sits inside <Suspense>, as Next.js 16 requires with Cache Components.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navLink = 'rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10';
  return (
    <div className="flex min-h-screen flex-wrap bg-[#F4F5F7] text-[#0A2540]">
      <aside className="flex w-full flex-wrap items-center gap-2 bg-[#0A2540] p-4 text-white md:min-h-screen md:w-60 md:flex-col md:flex-nowrap md:items-stretch">
        <Link href="/admin" className="mr-4 text-2xl font-extrabold tracking-tight md:mb-6 md:mr-0">Soko</Link>
        <nav aria-label="Admin" className="flex flex-wrap gap-1 md:flex-col">
          <Link href="/admin" className={navLink}>Dashboard</Link>
          <Link href="/admin/products" className={navLink}>Products</Link>
          <Link href="/admin/products/new" className={navLink}>Add a product</Link>
          <Link href="/admin/orders" className={navLink}>Orders</Link>
          <Link href="/admin/pickup-points" className={navLink}>Pickup points</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm md:ml-0 md:mt-auto md:flex-col md:items-stretch">
          <Suspense fallback={<span className="text-white/60">…</span>}>
            <CurrentUser />
          </Suspense>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="h-9 rounded-lg border border-white/40 px-3 font-bold">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-[#E3E7EC] bg-white px-6 py-3">
          <Suspense fallback={<span className="text-sm text-[#5B6B7C]">Loading today&apos;s rate…</span>}>
            <RateBox />
          </Suspense>
        </header>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </div>
    </div>
  );
}

async function CurrentUser() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <div>
      <div className="font-bold">{session.user.name}</div>
      <div className="text-xs text-white/70">{session.user.role === 'ADMIN' ? 'Administrator' : 'Staff'}</div>
    </div>
  );
}

async function RateBox() {
  await connection();
  const rate = await getCurrentRate();
  return (
    <form action={setRate} className="flex flex-wrap items-center gap-2 text-sm">
      <span>
        Today&apos;s rate: <b>{rate ? `$1 = ${cdf(1, rate.cdfPerUsd)}` : 'not set yet'}</b>
        {rate && (
          <span className="text-[#5B6B7C]">
            {' '}· set {rate.effectiveFrom.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kinshasa' })} (Kinshasa time)
          </span>
        )}
      </span>
      <label htmlFor="cdfPerUsd" className="sr-only">New rate, francs per dollar</label>
      <input
        id="cdfPerUsd"
        name="cdfPerUsd"
        type="number"
        min={100}
        max={100000}
        step="0.01"
        required
        placeholder="New rate"
        className="h-9 w-28 rounded-lg border border-[#C9D1DA] px-2 outline-none focus:border-[#0A2540]"
      />
      <button type="submit" className="h-9 rounded-lg bg-[#0A2540] px-3 font-bold text-white">Update</button>
    </form>
  );
}
