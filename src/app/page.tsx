'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/auth-gate';
import { apiMe } from '@/lib/api';

// Landing page: authenticated users go to their last opened project or
// the dashboard; everyone else to /login.
function Redirector() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiMe();
      if (cancelled) {
        return;
      }
      if (result.ok && result.lastOpenedProjectId) {
        router.replace(`/project/${result.lastOpenedProjectId}`);
      } else {
        router.replace(result.ok ? '/dashboard' : '/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}

export default function HomePage() {
  return (
    <AuthGate>
      <Redirector />
    </AuthGate>
  );
}
