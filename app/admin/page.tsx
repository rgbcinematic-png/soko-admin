import { Suspense } from 'react';
import { auth, signOut } from '@/auth';

// Placeholder: the real dashboard (products, stock, orders) comes in a later step.
// With Cache Components on, anything that reads the login cookie sits inside
// <Suspense>, so the rest of the page can load straight away.
export default function AdminHome() {
  return (
    <main className="min-h-screen bg-[#F4F5F7] p-8 text-[#0A2540]">
      <h1 className="text-2xl font-extrabold">Soko admin</h1>
      <Suspense fallback={<p className="mt-2 text-[#5B6B7C]">Checking your login…</p>}>
        <SignedInAs />
      </Suspense>
      <form
        className="mt-6"
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button type="submit" className="h-10 rounded-lg border border-[#0A2540] px-4 font-bold">Sign out</button>
      </form>
    </main>
  );
}

async function SignedInAs() {
  const session = await auth();
  return <p className="mt-2">Signed in as {session?.user?.name} ({session?.user?.role}).</p>;
}
