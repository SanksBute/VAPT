'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

const PUBLIC_PATHS = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/accept-invitation'];

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { isAuthenticated, refreshToken, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (!isAuthenticated && !isPublicPath) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isAuthenticated && isPublicPath && pathname !== '/verify-email') {
      router.push('/dashboard');
      return;
    }
  }, [isAuthenticated, isPublicPath, pathname, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Refresh token every 12 minutes (access token lasts 15 minutes)
    const interval = setInterval(
      async () => {
        try {
          await refreshToken();
        } catch {
          clearAuth();
          router.push('/login');
        }
      },
      12 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshToken, clearAuth, router]);

  return <>{children}</>;
}
