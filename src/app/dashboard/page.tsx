import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiMe } from '@/lib/api';
import LogoutButton from './logout-button';
import NewProjectButton from './new-project-button';
import ImportXmiButton from './import-xmi-button';
import AiCreatorButton from './ai-creator-button';
import ProjectList from './project-list';
import DashboardTitle from './dashboard-title';
import LanguageToggle from '@/components/language-toggle';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = cookies();
  const username = await apiMe(cookieStore.get('token')?.value);
  if (!username) {
    redirect('/login');
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <DashboardTitle />
      <header className="flex items-center justify-between">
        <span className="text-xl">{username}</span>
        <div className="flex items-center gap-2">
          <AiCreatorButton />
          <LogoutButton />
          <LanguageToggle />
        </div>
      </header>
      <section className="flex justify-end gap-2">
        <NewProjectButton />
        <ImportXmiButton />
      </section>
      <section>
        <ProjectList />
      </section>
    </main>
  );
}
