import { useEffect, useState } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";

import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";
import { categoryService } from "../services";
import type { CategoryWithCount } from "../types";

/**
 * Shell shared by every page.
 *
 * Categories are fetched once here and handed to both the header rail and the
 * footer, so navigating between pages does not refetch them.
 */
export function RootLayout() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    categoryService
      .list(controller.signal)
      .then(setCategories)
      // A failed category load degrades navigation but must not blank the page.
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-[6px] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper"
      >
        Skip to content
      </a>

      <Navbar categories={categories} />

      <main id="main" className="flex-1">
        <Outlet context={{ categories }} />
      </main>

      <Footer categories={categories} />
      <ScrollRestoration />
    </div>
  );
}

export interface LayoutContext {
  categories: CategoryWithCount[];
}
