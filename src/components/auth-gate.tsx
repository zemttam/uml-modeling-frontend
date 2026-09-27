'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiMe, getToken } from '@/lib/api';

interface AuthGateProps {
  children: ReactNode;
  /** true on auth pages (/login, /signup): an authenticated user is redirected away */
  authPage?: boolean;
}

// Client-side auth gate. Reads the JWT from localStorage, validates it
// against GET /auth/me with an Authorization Bearer header, then either
// renders the children (protected pages) or redirects to /dashboard
// (auth pages). Protected pages redirect to /login when validation
// fails. Renders a neutral loading state until validation completes.
export default function AuthGate({ children, authPage = false }: AuthGateProps) {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        if (!cancelled) {
          if (authPage) {
            setState('allowed');
          } else {
            router.replace('/login');
          }
        }
        return;
      }
      const result = await apiMe();
      if (cancelled) {
        return;
      }
      if (result.ok) {
        if (authPage) {
          router.replace('/dashboard');
        } else {
          setState('allowed');
        }
      } else if (result.status === 401) {
        if (authPage) {
          setState('allowed');
        } else {
          router.replace('/login');
        }
      } else if (result.status === 0) {
        // network failure: allow auth pages, keep protected pages waiting
        if (authPage) {
          setState('allowed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authPage, router]);

  if (state !== 'allowed') {
    return null;
  }
  return <>{children}</>;
}
