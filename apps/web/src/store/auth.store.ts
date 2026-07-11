import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiPost, ApiError } from '@/lib/api-client';

interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  organizationId: string;
  role: string;
  permissions: string[];
  sessionId: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;

  login: (email: string, password: string, mfaCode?: string) => Promise<void | { mfaRequired: true; challengeToken: string; method: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setUser: (user: User) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  isAtLeastRole: (role: string) => boolean;
}

const ROLE_HIERARCHY = ['VIEWER', 'API_USER', 'ANALYST', 'PENETRATION_TESTER', 'SECURITY_ENGINEER', 'ORG_ADMIN', 'ORG_OWNER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,

      login: async (email, password, mfaCode) => {
        set({ isLoading: true });
        try {
          const result = await apiPost<
            | { accessToken: string; expiresIn: number }
            | { mfaRequired: true; challengeToken: string; method: string }
          >('/auth/login', { email, password, mfaCode });

          if ('mfaRequired' in result) {
            set({ isLoading: false });
            return result;
          }

          // Store access token
          localStorage.setItem('access_token', result.accessToken);
          set({ accessToken: result.accessToken });

          // Fetch user profile using GET (me endpoint)
          const { apiGet } = await import('@/lib/api-client');
          const me = await apiGet<User>('/auth/me');
          localStorage.setItem('organization_id', me.organizationId);

          set({
            user: me,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await apiPost('/auth/logout', undefined);
        } catch {
          // Ignore logout errors
        } finally {
          localStorage.removeItem('access_token');
          localStorage.removeItem('organization_id');
          set({ user: null, isAuthenticated: false, accessToken: null });
        }
      },

      refreshToken: async () => {
        try {
          const result = await apiPost<{ accessToken: string; expiresIn: number }>(
            '/auth/refresh',
            undefined,
          );
          localStorage.setItem('access_token', result.accessToken);
          set({ accessToken: result.accessToken });
        } catch {
          get().clearAuth();
          throw new Error('Session expired. Please log in again.');
        }
      },

      setUser: (user) => set({ user, isAuthenticated: true }),

      clearAuth: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('organization_id');
        set({ user: null, isAuthenticated: false, accessToken: null });
      },

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_ADMIN') return true;
        return user.permissions.includes(permission);
      },

      isAtLeastRole: (role) => {
        const { user } = get();
        if (!user) return false;
        const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role);
        const requiredRoleIndex = ROLE_HIERARCHY.indexOf(role);
        return userRoleIndex >= requiredRoleIndex;
      },
    }),
    {
      name: 'sentinelx-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
    },
  ),
);
