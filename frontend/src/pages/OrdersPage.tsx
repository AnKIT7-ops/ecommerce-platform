import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { OrderCard } from "../components/OrderCard";
import { Pagination } from "../components/Pagination";
import { PageHeader } from "../components/PageHeader";
import { Button, EmptyState, ErrorMessage, LoadingSpinner } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { orderService } from "../services";
import type { OrderSummary, Page } from "../types";

const PAGE_SIZE = 10;

export function OrdersPage() {
  useDocumentTitle("Your orders");

  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<OrderSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        setResult(await orderService.list(page, PAGE_SIZE, controller.signal));
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Could not load your orders.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [page, reloadToken]);

  if (isLoading && !result) return <LoadingSpinner label="Loading your orders" />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="History"
        title="Your orders"
        meta={
          result && result.total > 0 ? (
            <>
              <span className="tabular font-semibold text-ink">{result.total}</span>{" "}
              {result.total === 1 ? "order" : "orders"} placed
            </>
          ) : undefined
        }
      />

      {error ? (
        <ErrorMessage
          title="Could not load your orders"
          message={error}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : result && result.items.length > 0 ? (
        <>
          <ul className="space-y-3">
            {result.items.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>
          <div className="mt-10">
            <Pagination page={result.page} pages={result.pages} onChange={setPage} />
          </div>
        </>
      ) : (
        <EmptyState
          title="No orders yet"
          description="Once you place an order it will appear here, with its status and everything in it."
          action={
            <Link to="/products">
              <Button size="lg">Browse products</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
