'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirectTo: '/admin',
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately vague: never confirm whether an email exists.
      return { error: 'Those details did not match. Please try again.' };
    }
    throw error; // redirect() throws — let Next handle it
  }
}
