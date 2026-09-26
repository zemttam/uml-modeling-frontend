'use client';

import { useRouter } from 'next/navigation';
import { apiLogout } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';

export default function LogoutButton() {
  const router = useRouter();
  const { t } = useLanguage();

  async function handleClick() {
    await apiLogout();
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border px-4 py-2 hover:opacity-80"
    >
      {t('dashboard.logout')}
    </button>
  );
}
