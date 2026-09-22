import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiMe } from '@/lib/api';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const cookieStore = cookies();
  const username = await apiMe(cookieStore.get('token')?.value);
  if (username) {
    redirect('/dashboard');
  }
  return <LoginForm />;
}
