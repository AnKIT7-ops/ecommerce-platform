import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AUTH_EXPIRED_EVENT, authService, tokenStore } from "../services";
import { AuthContext, type AuthContextValue } from "./auth-context";
import type { AuthResponse, User } from "../types";


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((response: AuthResponse) => {
    tokenStore.save(response);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    // The server holds no session state, so signing out is purely local:
    // drop the tokens and the user.
    tokenStore.clear();
    setUser(null);
  }, []);

  // Restore the session on first load. A stored token may be expired, in which
  // case the api layer tries one refresh before giving up.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStore.getAccess()) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await authService.me();
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) tokenStore.clear();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // The api layer fires this when a refresh fails, so a session that expires
  // mid-visit clears the UI instead of leaving a stale signed-in header.
  useEffect(() => {
    const handleExpiry = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiry);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiry);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(await authService.login(email, password));
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      applySession(await authService.register({ email, password, full_name: fullName }));
    },
    [applySession],
  );

  const refreshUser = useCallback(async () => {
    setUser(await authService.me());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
