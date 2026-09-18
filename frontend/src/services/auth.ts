import { api } from "./api";
import type { AuthResponse, TokenPair, User } from "../types";

export interface RegisterInput {
  email: string;
  password: string;
  full_name?: string;
}

export const authService = {
  register: (input: RegisterInput) =>
    api.post<AuthResponse>("/api/auth/register", input, { auth: false }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>("/api/auth/login", { email, password }, { auth: false }),

  refresh: (refreshToken: string) =>
    api.post<TokenPair>("/api/auth/refresh", { refresh_token: refreshToken }, { auth: false }),

  me: () => api.get<User>("/api/auth/me"),

  updateProfile: (fullName: string) =>
    api.patch<User>("/api/auth/me", { full_name: fullName }),
};
