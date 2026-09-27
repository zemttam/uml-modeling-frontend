'use client';

import AuthGate from '@/components/auth-gate';
import SignupForm from './signup-form';

export default function SignupPage() {
  return (
    <AuthGate authPage>
      <SignupForm />
    </AuthGate>
  );
}
