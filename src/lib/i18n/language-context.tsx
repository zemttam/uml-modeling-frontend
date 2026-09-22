'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { en } from './en';
import { es } from './es';

export type Language = 'en' | 'es';
export type TranslationKey = keyof typeof en;

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = {
  en,
  es,
};

const STORAGE_KEY = 'uml-ui-lang';

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'es') {
        setLangState(stored);
      }
    } catch {
      // localStorage unavailable: keep English default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Persistence is best-effort.
    }
  }, [lang]);

  const setLang = useCallback((next: Language) => setLangState(next), []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const dict = DICTIONARIES[lang];
      const template = dict[key] ?? en[key] ?? key;
      return interpolate(template, params);
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
