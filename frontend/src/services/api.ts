/**
 * The single place this app talks to the network.
 *
 * Handles the base URL, JSON encoding, bearer tokens, one automatic refresh on
 * 401, and turning API errors into a typed `ApiError`. Components never call
 * `fetch` directly.
 */

import type { TokenPair } from "../types";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "ampere.access_token";
const REFRESH_TOKEN_KEY = "ampere.refresh_token";

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** True when the request failed before reaching the server. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

// --- Token storage ----------------------------------------------------------
// localStorage can throw in private browsing, so every access is guarded.

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    /* Storage unavailable; the session simply will not survive a reload. */
  }
}

export const tokenStore = {
  getAccess: (): string | null => readStorage(ACCESS_TOKEN_KEY),
  getRefresh: (): string | null => readStorage(REFRESH_TOKEN_KEY),
  save(tokens: TokenPair): void {
    writeStorage(ACCESS_TOKEN_KEY, tokens.access_token);
    writeStorage(REFRESH_TOKEN_KEY, tokens.refresh_token);
  },
  clear(): void {
    writeStorage(ACCESS_TOKEN_KEY, null);
    writeStorage(REFRESH_TOKEN_KEY, null);
  },
};

/** Fired when a session ends unrecoverably, so AuthContext can reset itself. */
export const AUTH_EXPIRED_EVENT = "ampere:auth-expired";

function announceSessionExpired(): void {
  tokenStore.clear();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

// --- Request plumbing -------------------------------------------------------

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Send the access token. Defaults to true; public reads pass false. */
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/** Pull a readable message and per-field errors out of an error response. */
async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  const fieldErrors: Record<string, string> = {};

  try {
    const body = await response.json();
    if (typeof body?.detail === "string") {
      message = body.detail;
    }
    if (Array.isArray(body?.errors)) {
      for (const problem of body.errors) {
        if (problem?.field) {
          fieldErrors[problem.field] = problem.message ?? "Invalid value";
        }
      }
    }
  } catch {
    /* Non-JSON error body; keep the generic message. */
  }

  return new ApiError(response.status, message, fieldErrors);
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;

  try {
    const response = await fetch(buildUrl("/api/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;

    tokenStore.save((await response.json()) as TokenPair);
    return true;
  } catch {
    return false;
  }
}

async function send(path: string, options: RequestOptions, retrying = false): Promise<Response> {
  const { method = "GET", body, auth = true, query, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = auth ? tokenStore.getAccess() : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Cannot reach the server. Check that the API is running.");
  }

  // One refresh attempt, then give up. Retrying twice would loop on a revoked
  // refresh token.
  if (response.status === 401 && auth && token && !retrying) {
    if (await refreshSession()) {
      return send(path, options, true);
    }
    announceSessionExpired();
  }

  return response;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

export { API_URL };
