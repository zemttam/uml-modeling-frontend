import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiLastOpenedProjectId, apiMe } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = cookies();
  const lastOpenedProjectId = await apiLastOpenedProjectId(
    cookieStore.get('token')?.value,
  );
  if (lastOpenedProjectId) {
    redirect(`/project/${lastOpenedProjectId}`);
  }
  const username = await apiMe(cookieStore.get('token')?.value);
  redirect(username ? '/dashboard' : '/login');
}
