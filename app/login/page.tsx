import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Connexion · Soko admin',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#F4F5F7] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-3xl font-extrabold tracking-tight text-[#0A2540]">Soko</p>
        <h1 className="mt-4 text-xl font-bold text-[#0A2540]">Sign in to the admin</h1>
        <p className="mt-1 mb-6 text-sm text-[#5B6B7C]">Staff access only. Sessions expire after 8 hours.</p>
        <LoginForm />
      </div>
    </main>
  );
}
