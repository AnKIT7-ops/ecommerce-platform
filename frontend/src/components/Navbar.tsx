import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import type { CategoryWithCount } from "../types";
import { SearchBar } from "./SearchBar";

interface NavbarProps {
  categories: CategoryWithCount[];
}

export function Navbar({ categories }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user, logout } = useAuth();
  const { itemCount } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const routeKey = `${location.pathname}${location.search}`;
  const [lastRouteKey, setLastRouteKey] = useState(routeKey);

  const searchValue = location.pathname === "/products" ? (searchParams.get("search") ?? "") : "";

  // A route change means the mobile drawer has served its purpose.
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey);
    setIsMenuOpen(false);
  }

  function runSearch(term: string) {
    const trimmed = term.trim();
    navigate(trimmed ? `/products?search=${encodeURIComponent(trimmed)}` : "/products");
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-ink"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-ink text-sm font-bold text-paper"
          >
            A
          </span>
          Ampere
        </Link>

        <SearchBar
          value={searchValue}
          onChange={() => undefined}
          onSubmit={runSearch}
          className="hidden flex-1 md:block"
        />

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
          <HeaderLink to="/products">Shop</HeaderLink>
          {isAuthenticated ? (
            <>
              <HeaderLink to="/orders">Orders</HeaderLink>
              <HeaderLink to="/account">Account</HeaderLink>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-[6px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-shell hover:text-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <HeaderLink to="/login">Sign in</HeaderLink>
              <Link
                to="/register"
                className="rounded-[6px] bg-ink px-3.5 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ink/85"
              >
                Create account
              </Link>
            </>
          )}
          <CartLink count={itemCount} />
        </nav>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <CartLink count={itemCount} />
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 items-center justify-center rounded-[6px] hover:bg-shell"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              {isMenuOpen ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Category rail: the fastest route into the catalogue on desktop. */}
      <div className="hidden border-t border-hairline md:block">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {categories.map((category) => (
            <NavLink
              key={category.id}
              to={`/products?category=${category.slug}`}
              className="eyebrow shrink-0 px-3 py-2.5 whitespace-nowrap transition-colors hover:text-ink"
            >
              {category.name}
            </NavLink>
          ))}
        </div>
      </div>

      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-hairline bg-paper md:hidden">
          <div className="space-y-4 px-4 py-4">
            <SearchBar value={searchValue} onChange={() => undefined} onSubmit={runSearch} />

            <nav className="flex flex-col" aria-label="Mobile">
              <MobileLink to="/products">Shop all</MobileLink>
              {isAuthenticated ? (
                <>
                  <MobileLink to="/orders">Orders</MobileLink>
                  <MobileLink to="/account">Account</MobileLink>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="py-2.5 text-left text-sm font-medium text-muted"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <MobileLink to="/login">Sign in</MobileLink>
                  <MobileLink to="/register">Create account</MobileLink>
                </>
              )}
            </nav>

            <div className="border-t border-hairline pt-3">
              <p className="eyebrow mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/products?category=${category.slug}`}
                    className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.role === "admin" && (
        <p className="bg-ink px-4 py-1.5 text-center text-xs font-medium text-paper">
          Signed in as an administrator. Catalogue editing lives in the API docs at /docs.
        </p>
      )}
    </header>
  );
}

function HeaderLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "rounded-[6px] px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "text-volt" : "text-ink hover:bg-shell",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

function MobileLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        ["py-2.5 text-sm font-medium", isActive ? "text-volt" : "text-ink"].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

function CartLink({ count }: { count: number }) {
  return (
    <NavLink
      to="/cart"
      className="relative flex h-10 w-10 items-center justify-center rounded-[6px] transition-colors hover:bg-shell"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none">
        <path
          d="M3 5h2.2l1.6 9.2a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L20 8H6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="20" r="1.4" fill="currentColor" />
        <circle cx="17" cy="20" r="1.4" fill="currentColor" />
      </svg>
      {count > 0 && (
        <span className="tabular absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-volt px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </NavLink>
  );
}
