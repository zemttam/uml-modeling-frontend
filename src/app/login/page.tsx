'use client';

import AuthGate from '@/components/auth-gate';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <AuthGate authPage>
      <LoginForm />
    </AuthGate>
  );
}
