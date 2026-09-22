'use client';

import { useLanguage } from '@/lib/i18n/language-context';

// Two-state toggle: the label names the current language in that language
// ("English" / "Español"); clicking flips to the other language.
export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
      className="rounded border px-4 py-2 hover:opacity-80"
    >
      {t('language.current')}
    </button>
  );
}
