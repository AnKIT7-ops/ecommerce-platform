import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { ProductGrid } from "../components/ProductGrid";
import { ProductGridSkeleton } from "../components/ProductGridSkeleton";
import { Button, ErrorMessage } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { LayoutContext } from "../layouts/RootLayout";
import { productService } from "../services";
import type { CategoryWithCount, Product } from "../types";

/**
 * The storefront's front page, built as an instrument panel: a graticule-lit
 * hero, a ruler rail, a department index that reads like a switchboard, and
 * four featured products presented as catalogue specimens with registration
 * marks. Everything below the hero reuses the shared grid so the page still
 * looks like the rest of the store.
 *
 * Load is one orchestrated sequence rather than scattered micro-animations:
 * each block rises once on its own `animationDelay`. `prefers-reduced-motion`
 * is honoured globally in index.css.
 */
export function HomePage() {
  useDocumentTitle();
  const { categories } = useOutletContext<LayoutContext>();

  const [featured, setFeatured] = useState<Product[]>([]);
  const [newest, setNewest] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [inStock, latest] = await Promise.all([
          productService.list(
            { in_stock: true, sort: "price_desc", size: 4 },
            controller.signal,
          ),
          productService.list({ sort: "newest", size: 8 }, controller.signal),
        ]);
        setFeatured(inStock.items);
        setNewest(latest.items);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Could not load products.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return (
    <div>
      <Hero departments={categories.length} />
      <MeasureRail />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="py-10">
            <ErrorMessage
              title="Could not load the catalogue"
              message={error}
              onRetry={() => window.location.reload()}
            />
          </div>
        )}

        <DepartmentIndex categories={categories} />

        <Section
          index="02"
          eyebrow="In stock now"
          title="The serious end of the catalogue"
          description="Our highest-specified gear, all of it on the shelf today."
          action={
            <Link to="/products?in_stock=true&sort=price_desc">
              <Button variant="secondary" size="sm">
                See everything in stock
              </Button>
            </Link>
          }
        >
          {isLoading ? (
            <ProductGridSkeleton count={4} />
          ) : (
            <ProductGrid products={featured} numbered />
          )}
        </Section>

        <Section
          index="03"
          eyebrow="Just landed"
          title="New arrivals"
          description="The most recent additions to the shelves."
          action={
            <Link to="/products?sort=newest">
              <Button variant="secondary" size="sm">
                Shop all products
              </Button>
            </Link>
          }
        >
          {isLoading ? <ProductGridSkeleton count={8} /> : <ProductGrid products={newest} />}
        </Section>
      </div>

      <StockPanel />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Hero({ departments }: { departments: number }) {
  return (
    <section className="graticule grain relative overflow-hidden border-b border-hairline bg-panel text-paper">
      {/* A single volt bloom off the top-left corner, so the panel looks lit
          from somewhere rather than uniformly dark. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full opacity-[0.16] blur-[110px]"
        style={{ background: "radial-gradient(circle, var(--color-volt), transparent 68%)" }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-x-12 gap-y-14 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-28">
        <div className="lg:col-span-8">
          <p
            className="eyebrow reveal flex items-center gap-2.5 text-paper/55"
            style={{ animationDelay: "40ms" }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-volt shadow-[0_0_10px_2px_var(--color-volt)]" />
            Est. 2026 &middot; Ships worldwide
          </p>

          {/* The headline runs wider than the body copy column and is set on
              Archivo's expanded axis - the one piece of type meant to be
              remembered. */}
          <h1
            className="display-wide reveal mt-6 text-[2.75rem] leading-[0.94] font-extrabold sm:text-6xl lg:text-[4.75rem]"
            style={{ animationDelay: "120ms" }}
          >
            {/* Inline on phones so the line breaks fall naturally; forced to
                three measured lines once there is room for them. */}
            <span className="sm:block">The parts bin for </span>
            <span className="sm:block">people who read </span>
            <span className="relative inline-block">
              the spec sheet.
              <span
                aria-hidden
                className="absolute -bottom-2 left-0 h-[3px] w-full bg-volt"
                style={{ animation: "reveal-up 900ms 620ms backwards" }}
              />
            </span>
          </h1>

          <p
            className="reveal mt-9 max-w-lg text-base leading-relaxed text-paper/65"
            style={{ animationDelay: "220ms" }}
          >
            Laptops, handsets, peripherals and workspace hardware, described in plain language
            with the numbers that actually matter.
          </p>

          <div
            className="reveal mt-9 flex flex-wrap gap-3"
            style={{ animationDelay: "300ms" }}
          >
            <Link to="/products">
              <Button size="lg">Browse the catalogue</Button>
            </Link>
            <Link to="/products?in_stock=true">
              <Button
                size="lg"
                variant="secondary"
                className="border-paper/25 bg-transparent text-paper hover:border-paper hover:bg-paper/10"
              >
                Only what is in stock
              </Button>
            </Link>
          </div>
        </div>

        {/* Readout column: the spec strip from the old hero, rebuilt as a
            stacked instrument panel and moved alongside the headline so the
            composition is asymmetric rather than centred. */}
        <dl
          className="reveal self-end lg:col-span-4"
          style={{ animationDelay: "380ms" }}
        >
          {[
            { label: "Departments", value: String(departments).padStart(2, "0"), note: "live" },
            { label: "Warranty", value: "24", unit: "mo", note: "all stock" },
            { label: "Dispatch", value: "24", unit: "h", note: "weekdays" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-baseline justify-between gap-4 border-t border-paper/12 py-4 first:border-t-0"
            >
              <div>
                <dt className="eyebrow label-narrow text-paper/45">{stat.label}</dt>
                <dd className="tabular mt-1.5 text-3xl leading-none font-bold text-paper">
                  {stat.value}
                  {stat.unit && (
                    <span className="ml-0.5 text-sm font-medium text-paper/45">{stat.unit}</span>
                  )}
                </dd>
              </div>
              <span className="eyebrow label-narrow text-paper/30">{stat.note}</span>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** A ruler strip. Pure decoration, but it sets the measuring motif early. */
function MeasureRail() {
  return (
    <div
      aria-hidden
      className="tick-rail mx-auto h-[11px] max-w-7xl px-4 opacity-60 sm:px-6 lg:px-8"
    />
  );
}

function DepartmentIndex({ categories }: { categories: CategoryWithCount[] }) {
  return (
    <Section
      index="01"
      eyebrow="Browse"
      title="Shop by department"
      description="Six departments, each stocked with gear we would use ourselves."
      action={
        <Link to="/products">
          <Button variant="secondary" size="sm">
            View the full catalogue
          </Button>
        </Link>
      }
    >
      {/* A switchboard index rather than a row of boxes: numbered rows, counts
          right-aligned in tabular figures, a volt trace wiping across on hover. */}
      <ul className="border-t border-hairline">
        {categories.map((category, position) => (
          <li key={category.id} className="group relative">
            <Link
              to={`/products?category=${category.slug}`}
              className="trace-sweep flex items-center gap-4 border-b border-hairline py-4 pr-2 pl-3 sm:gap-6 sm:pl-4"
            >
              <span className="eyebrow label-narrow w-7 shrink-0 text-muted/70">
                {String(position + 1).padStart(2, "0")}
              </span>

              <span className="display-wide flex-1 text-lg font-bold text-ink transition-colors group-hover:text-volt sm:text-2xl">
                {category.name}
              </span>

              <span className="hidden max-w-sm flex-1 truncate text-[13px] text-muted md:block">
                {category.description}
              </span>

              <span className="tabular w-20 shrink-0 text-right text-sm font-semibold text-ink">
                {String(category.product_count).padStart(2, "0")}
                <span className="ml-1 text-[11px] font-normal text-muted">
                  item{category.product_count === 1 ? "" : "s"}
                </span>
              </span>

              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="h-4 w-4 shrink-0 text-muted transition-[transform,color] group-hover:translate-x-1 group-hover:text-volt"
              >
                <path
                  d="M2 8h11M9 4l4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Closing statement, on the same lit panel as the hero so the page bookends. */
function StockPanel() {
  return (
    <section className="graticule grain relative mt-16 overflow-hidden border-t border-hairline bg-panel text-paper">
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-5">
          <p className="eyebrow label-narrow text-paper/45">Why shop here</p>
          <h2 className="display-wide mt-3 text-3xl leading-[1.02] font-extrabold sm:text-[2.75rem]">
            Stock counts
            <br />
            you can trust.
          </h2>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <p className="max-w-xl text-base leading-relaxed text-paper/65">
            Every listing shows what is genuinely on the shelf. If two people reach for the last
            unit at the same moment, only one order goes through, and the other person is told
            immediately rather than a week later.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/products">
              <Button size="lg">Start shopping</Button>
            </Link>
            <Link to="/register">
              <Button
                size="lg"
                variant="secondary"
                className="border-paper/25 bg-transparent text-paper hover:border-paper hover:bg-paper/10"
              >
                Create an account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

interface SectionProps {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** A titled band on the home page. The heading block itself is shared. */
function Section({ index, eyebrow, title, description, action, children }: SectionProps) {
  return (
    <section className="py-14">
      <PageHeader
        level="h2"
        index={index}
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={action}
      />
      {children}
    </section>
  );
}
