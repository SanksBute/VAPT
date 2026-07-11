'use client';

import { useEffect, useState } from 'react';
import { useUxStore } from '@/store/ux.store';
import { useAuthStore } from '@/store/auth.store';
import { OnboardingWizard } from './onboarding-wizard';

export function OnboardingGuard(): JSX.Element | null {
  const { onboarding } = useUxStore();
  const { isAuthenticated } = useAuthStore();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Show onboarding for authenticated users who haven't completed it
    if (isAuthenticated && !onboarding.completed) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated, onboarding.completed]);

  if (!showOnboarding) return null;

  return (
    <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
  );
}
