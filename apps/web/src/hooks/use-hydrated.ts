import { useEffect, useState } from 'react';

/**
 * Zustand `persist` rehydrates from localStorage synchronously on the client
 * before React's first client render, so components reading persisted state
 * (auth user, UX preferences) render different output server vs. client and
 * trigger hydration mismatches. Gate that state on this hook: it returns
 * `false` on both the server render and the client's initial (hydrating)
 * render, then flips to `true` in an effect once mounted.
 */
export function useHasHydrated(): boolean {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
}
