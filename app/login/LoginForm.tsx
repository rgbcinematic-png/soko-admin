'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const initial: LoginState = {};

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-[#0A2540]">Email</label>
        <input
          id="email" name="email" type="email" autoComplete="username" required
          className="h-11 rounded-lg border border-[#C9D1DA] px-3 text-[#0A2540] outline-none focus:border-[#0A2540]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-[#0A2540]">Password</label>
        <input
          id="password" name="password" type="password" autoComplete="current-password" minLength={8} required
          className="h-11 rounded-lg border border-[#C9D1DA] px-3 text-[#0A2540] outline-none focus:border-[#0A2540]"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-[#BE123C]">{state.error}</p>
      )}

      <button
        type="submit" disabled={pending}
        className="h-12 rounded-xl bg-[#FF7A1A] font-bold text-[#0A2540] disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
