'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiLogin } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import LanguageToggle from '@/components/language-toggle';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const justCreated = searchParams.get('created') === '1';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const result = await apiLogin(username, password);
    if (result.ok) {
      const target = result.lastOpenedProjectId
        ? `/project/${result.lastOpenedProjectId}`
        : '/dashboard';
      router.push(target);
      router.refresh();
    } else {
      setError(t('auth.incorrectCredentials'));
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="fixed right-4 top-4">
        <LanguageToggle />
      </div>
      <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-4">
        <h1 className="text-center text-3xl font-bold">{t('auth.loginTitle')}</h1>
        {justCreated && <p className="text-center text-green-600">{t('auth.accountCreated')}</p>}
        {error && <p className="text-center text-red-500">{error}</p>}
        <input
          type="text"
          placeholder={t('auth.usernamePlaceholder')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          required
        />
        <input
          type="password"
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          required
        />
        <button type="submit" className="rounded bg-blue-600 py-2 text-white hover:bg-blue-700">
          {t('auth.loginSubmit')}
        </button>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t('auth.loginLinkPrefix')}{' '}
          <a href="/signup" className="text-blue-600 dark:text-blue-400 hover:underline">
            {t('auth.loginLinkText')}
          </a>
        </p>
      </form>
    </main>
  );
}
