import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

import { ProductGrid } from "../components/ProductGrid";
import { ProductGridSkeleton } from "../components/ProductGridSkeleton";
import { Button, ErrorMessage } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { LayoutContext } from "../layouts/RootLayout";
import { productService } from "../services";
import type { Product } from "../types";

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
      <Hero />

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

        <Section
          eyebrow="Browse"
          title="Shop by category"
          description="Six departments, each stocked with gear we would use ourselves."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.slug}`}
                className="group flex flex-col justify-between rounded-[6px] border border-hairline bg-paper p-4 transition-colors hover:border-ink"
              >
                <span className="text-sm font-semibold text-ink group-hover:text-volt">
                  {category.name}
                </span>
                <span className="tabular mt-6 text-xs text-muted">
                  {category.product_count} item{category.product_count === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </Section>

        <Section
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
          {isLoading ? <ProductGridSkeleton count={4} /> : <ProductGrid products={featured} />}
        </Section>

        <Section
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

        <section className="my-16 rounded-[6px] border border-hairline bg-paper px-6 py-12 text-center sm:px-12">
          <p className="eyebrow">Why shop here</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Stock counts you can trust
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Every listing shows what is genuinely on the shelf. If two people reach for the last
            unit at the same moment, only one order goes through, and the other person is told
            immediately rather than a week later.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/products">
              <Button size="lg">Start shopping</Button>
            </Link>
            <Link to="/register">
              <Button variant="secondary" size="lg">
                Create an account
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="border-b border-hairline bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <p className="eyebrow text-paper/60">Est. 2026 &middot; Ships worldwide</p>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
          The parts bin for people who read the spec sheet.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-paper/70">
          Laptops, handsets, peripherals and workspace hardware, described in plain language with
          the numbers that actually matter.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
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

        {/* Spec strip: the shelf-label motif that runs through the whole store. */}
        <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-[6px] border border-paper/15 bg-paper/15">
          {[
            { label: "Departments", value: "06" },
            { label: "Warranty", value: "24mo" },
            { label: "Dispatch", value: "24h" },
          ].map((stat) => (
            <div key={stat.label} className="bg-ink px-4 py-4">
              <dt className="eyebrow text-paper/50">{stat.label}</dt>
              <dd className="tabular mt-1 text-xl font-bold text-paper">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

interface SectionProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ eyebrow, title, description, action, children }: SectionProps) {
  return (
    <section className="py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{title}</h2>
          <p className="mt-1.5 text-sm text-muted">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
