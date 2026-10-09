import { redirect } from 'next/navigation';

// The site's home address goes straight to the admin (the login page if not signed in).
export default function Home() {
  redirect('/admin');
}
