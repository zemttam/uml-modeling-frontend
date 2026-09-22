import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiGetProjectServer, apiMe } from '@/lib/api';
import Editor from './editor';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const cookieStore = cookies();
  const username = await apiMe(cookieStore.get('token')?.value);
  if (!username) {
    redirect('/login');
  }
  const project = await apiGetProjectServer(
    params.id,
    cookieStore.get('token')?.value,
  );
  if (!project.ok || !project.id) {
    redirect('/dashboard');
  }
  return (
    <Editor projectId={project.id} projectName={project.name ?? ''} />
  );
}
