import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { CategoryFilter } from "../components/CategoryFilter";
import { Pagination } from "../components/Pagination";
import { PriceFilter } from "../components/PriceFilter";
import { ProductGrid } from "../components/ProductGrid";
import { ProductGridSkeleton } from "../components/ProductGridSkeleton";
import { SearchBar } from "../components/SearchBar";
import { SortSelect } from "../components/SortSelect";
import { Button, EmptyState, ErrorMessage } from "../components/ui";
import { useDebounced } from "../hooks/useDebounced";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { LayoutContext } from "../layouts/RootLayout";
import { productService } from "../services";
import type { Page, Product, ProductSort } from "../types";

const PAGE_SIZE = 12;
const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc", "name_asc", "name_desc"];

function isSort(value: string | null): value is ProductSort {
  return value !== null && (SORTS as string[]).includes(value);
}

export function ProductsPage() {
  const { categories } = useOutletContext<LayoutContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the source of truth for filters, so every view is shareable and
  // the back button behaves the way a shopper expects.
  const search = searchParams.get("search") ?? "";
  const categorySlug = searchParams.get("category") ?? undefined;
  const minPrice = searchParams.get("min_price") ?? undefined;
  const maxPrice = searchParams.get("max_price") ?? undefined;
  const inStockOnly = searchParams.get("in_stock") === "true";
  const sortParam = searchParams.get("sort");
  const sort: ProductSort = isSort(sortParam) ? sortParam : "newest";
  const page = Math.max(Number.parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);

  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebounced(searchDraft, 350);

  const [result, setResult] = useState<Page<Product> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCategory = categories.find((category) => category.slug === categorySlug);
  useDocumentTitle(activeCategory?.name ?? (search ? `Search: ${search}` : "All products"));

  // Sync the URL when typing settles, resetting to page 1 for a new query.
  useEffect(() => {
    if (debouncedSearch === search) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (debouncedSearch.trim()) {
          next.set("search", debouncedSearch.trim());
        } else {
          next.delete("search");
        }
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, search, setSearchParams]);

  // Adopt a search term that arrived from elsewhere (header, category link).
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setSearchDraft(search);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await productService.list(
          {
            ...(search ? { search } : {}),
            ...(categorySlug ? { category_slug: categorySlug } : {}),
            ...(minPrice ? { min_price: minPrice } : {}),
            ...(maxPrice ? { max_price: maxPrice } : {}),
            ...(inStockOnly ? { in_stock: true } : {}),
            sort,
            page,
            size: PAGE_SIZE,
          },
          controller.signal,
        );
        setResult(data);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Could not load products.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [search, categorySlug, minPrice, maxPrice, inStockOnly, sort, page]);

  function updateParams(changes: Record<string, string | undefined>, resetPage = true) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      if (resetPage) next.delete("page");
      return next;
    });
  }

  const hasFilters = Boolean(
    search || categorySlug || minPrice || maxPrice || inStockOnly || sortParam,
  );

  const filters = (
    <div className="space-y-7">
      <CategoryFilter
        categories={categories}
        selectedSlug={categorySlug}
        onSelect={(slug) => updateParams({ category: slug })}
      />

      <PriceFilter
        minPrice={minPrice}
        maxPrice={maxPrice}
        onApply={(min, max) => updateParams({ min_price: min, max_price: max })}
      />

      <div>
        <h2 className="eyebrow mb-3">Availability</h2>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(event) =>
              updateParams({ in_stock: event.target.checked ? "true" : undefined })
            }
            className="h-4 w-4 rounded border-hairline accent-volt"
          />
          In stock only
        </label>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" fullWidth onClick={() => setSearchParams({})}>
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="eyebrow">Catalogue</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {activeCategory?.name ?? "All products"}
        </h1>
        {activeCategory?.description && (
          <p className="mt-2 max-w-2xl text-sm text-muted">{activeCategory.description}</p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[236px_1fr]">
        {/* Filters collapse into a disclosure below the lg breakpoint. */}
        <details className="rounded-[6px] border border-hairline bg-paper p-4 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Filters and sorting
          </summary>
          <div className="mt-5">{filters}</div>
        </details>

        <aside className="hidden lg:block">
          <div className="sticky top-32">{filters}</div>
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <SearchBar
              value={searchDraft}
              onChange={setSearchDraft}
              className="min-w-0 flex-1"
              placeholder="Search by name or description"
            />
            <SortSelect value={sort} onChange={(next) => updateParams({ sort: next })} />
          </div>

          {result && !isLoading && (
            <p aria-live="polite" className="mb-4 text-sm text-muted">
              <span className="tabular font-semibold text-ink">{result.total}</span>{" "}
              {result.total === 1 ? "product" : "products"}
              {search && (
                <>
                  {" "}
                  matching <span className="font-semibold text-ink">{search}</span>
                </>
              )}
            </p>
          )}

          {error ? (
            <ErrorMessage
              title="Could not load products"
              message={error}
              onRetry={() => updateParams({}, false)}
            />
          ) : isLoading ? (
            <ProductGridSkeleton count={PAGE_SIZE} />
          ) : result && result.items.length > 0 ? (
            <>
              <ProductGrid products={result.items} />
              <div className="mt-10">
                <Pagination
                  page={result.page}
                  pages={result.pages}
                  onChange={(next) => {
                    updateParams({ page: String(next) }, false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </div>
            </>
          ) : (
            <EmptyState
              title="Nothing matches those filters"
              description="Try a different search term, widen the price range, or clear the filters to see the whole catalogue."
              action={
                <Button variant="secondary" onClick={() => setSearchParams({})}>
                  Clear all filters
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
