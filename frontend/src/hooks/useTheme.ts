import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ampere.theme";

/** Whatever the pre-paint script in index.html already decided. */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Reads and flips the theme.
 *
 * The initial value comes from the DOM rather than from storage, because the
 * inline script in index.html has already resolved the stored choice or the
 * system preference by the time React mounts. Reading it again here would risk
 * the two disagreeing.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Only an explicit choice is stored. Persisting on mount would freeze the
  // system preference into storage on a first visit, so a visitor who later
  // switched their OS to dark would be stuck on light forever.
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* Storage unavailable; the choice will not survive a reload. */
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
