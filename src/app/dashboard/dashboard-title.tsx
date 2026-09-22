'use client';

import { useLanguage } from '@/lib/i18n/language-context';

// Client component so the server-rendered dashboard heading can use t().
export default function DashboardTitle() {
  const { t } = useLanguage();
  return <h1 className="text-3xl font-bold">{t('dashboard.heading')}</h1>;
}
