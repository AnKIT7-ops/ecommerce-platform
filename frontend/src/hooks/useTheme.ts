import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ampere.theme";

/**
 * The theme lives in one module-level store rather than in component state.
 *
 * Two toggles are mounted at once — the desktop nav and the mobile bar are
 * both always in the DOM, only hidden by CSS — so per-component `useState`
 * gave each its own copy. Toggling at desktop width then resizing left the
 * mobile toggle rendering the wrong state, and its first click appeared to do
 * nothing because it recomputed from a stale value.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Read from the DOM, which the pre-paint script in index.html has already set
 * from storage or the system preference. Reading storage again here would risk
 * the two disagreeing.
 */
function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function setTheme(next: Theme): void {
  document.documentElement.dataset.theme = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* Storage unavailable; the choice will not survive a reload. */
  }
  for (const listener of listeners) listener();
}

export function useTheme() {
  // The server snapshot is only reached if this ever renders on the server,
  // where there is no document to read.
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);

  // Only an explicit choice is stored. Persisting on mount would freeze the
  // system preference into storage on a first visit, so a visitor who later
  // switched their OS to dark would be stuck on light forever.
  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);

  return { theme, toggleTheme };
}
