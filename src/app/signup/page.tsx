import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiMe } from '@/lib/api';
import SignupForm from './signup-form';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const cookieStore = cookies();
  const username = await apiMe(cookieStore.get('token')?.value);
  if (username) {
    redirect('/dashboard');
  }
  return <SignupForm />;
}
