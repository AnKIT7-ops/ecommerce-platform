import { createContext } from "react";

import type { User } from "../types";

export interface AuthContextValue {
  user: User | null;
  /** True until the stored session has been checked on first load. */
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
}

// Kept out of AuthContext.tsx so that file exports only components, which is
// what React Fast Refresh needs to hot-reload the provider.
export const AuthContext = createContext<AuthContextValue | null>(null);
