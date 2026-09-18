import { Link } from "react-router-dom";

import type { CategoryWithCount } from "../types";

export function Footer({ categories }: { categories: CategoryWithCount[] }) {
  return (
    <footer className="mt-20 border-t border-hairline bg-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-ink text-sm font-bold text-paper"
            >
              A
            </span>
            Ampere
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Components and gear for people who read the spec sheet. Real stock counts, no
            invented discounts.
          </p>
        </div>

        <nav aria-label="Categories">
          <h2 className="eyebrow mb-3">Shop</h2>
          <ul className="space-y-2">
            {categories.slice(0, 6).map((category) => (
              <li key={category.id}>
                <Link
                  to={`/products?category=${category.slug}`}
                  className="text-sm text-muted transition-colors hover:text-ink"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="eyebrow mb-3">Your account</h2>
          <ul className="space-y-2">
            <li>
              <Link to="/orders" className="text-sm text-muted transition-colors hover:text-ink">
                Order history
              </Link>
            </li>
            <li>
              <Link to="/cart" className="text-sm text-muted transition-colors hover:text-ink">
                Cart
              </Link>
            </li>
            <li>
              <Link to="/account" className="text-sm text-muted transition-colors hover:text-ink">
                Account details
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-hairline">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
          A demonstration storefront. Checkout is simulated and no payment is ever taken.
        </p>
      </div>
    </footer>
  );
}
