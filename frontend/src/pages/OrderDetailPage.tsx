import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Badge, Button, ErrorMessage, LoadingSpinner } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { ApiError, orderService } from "../services";
import type { Order } from "../types";
import {
  formatDateTime,
  formatOrderRef,
  formatPrice,
  statusPresentation,
} from "../utils/format";

const LIFECYCLE = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const justPlaced = searchParams.get("placed") === "1";

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useDocumentTitle(order ? formatOrderRef(order.id) : "Order");

  useEffect(() => {
    const controller = new AbortController();
    const orderId = Number(id);

    async function load() {
      setIsLoading(true);
      setError(null);

      if (!Number.isFinite(orderId)) {
        setError("That order link is not valid.");
        setIsLoading(false);
        return;
      }

      try {
        setOrder(await orderService.get(orderId, controller.signal));
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(
          caught instanceof ApiError && caught.status === 404
            ? "We could not find that order on your account."
            : caught instanceof Error
              ? caught.message
              : "Could not load this order.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [id]);

  async function handleCancel() {
    if (!order) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      setOrder(await orderService.cancel(order.id));
    } catch (caught) {
      setCancelError(
        caught instanceof Error ? caught.message : "Could not cancel this order.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) return <LoadingSpinner label="Loading order" />;

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <ErrorMessage title="Order unavailable" message={error ?? "Order not found."} />
        <Link to="/orders" className="mt-6 inline-block">
          <Button variant="secondary">Back to your orders</Button>
        </Link>
      </div>
    );
  }

  const status = statusPresentation(order.status);
  const isCancelled = order.status === "cancelled";
  const canCancel = order.status === "pending" || order.status === "confirmed";
  const currentStep = LIFECYCLE.indexOf(order.status as (typeof LIFECYCLE)[number]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {justPlaced && (
        <div
          role="status"
          className="mb-8 rounded-[6px] border border-good/25 bg-good-tint px-5 py-4"
        >
          <p className="font-semibold text-good">Order placed</p>
          <p className="mt-1 text-sm text-muted">
            Your stock is reserved. Keep this reference for your records.
          </p>
        </div>
      )}

      <nav aria-label="Breadcrumb" className="mb-6">
        <Link to="/orders" className="eyebrow transition-colors hover:text-ink">
          &larr; All orders
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <p className="eyebrow">Order</p>
          <h1 className="tabular mt-2 text-3xl font-extrabold tracking-tight text-ink">
            {formatOrderRef(order.id)}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Placed {formatDateTime(order.created_at)}
          </p>
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </header>

      {/* Lifecycle rail. Hidden once cancelled, where the sequence no longer applies. */}
      {!isCancelled && (
        <ol className="mt-8 grid grid-cols-5 gap-px overflow-hidden rounded-[6px] border border-hairline bg-hairline">
          {LIFECYCLE.map((step, index) => {
            const isDone = index <= currentStep;
            return (
              <li
                key={step}
                className={`px-2 py-3 text-center ${isDone ? "bg-volt-tint" : "bg-paper"}`}
                aria-current={index === currentStep ? "step" : undefined}
              >
                <span
                  className={`eyebrow block ${isDone ? "text-volt-dark" : "text-muted/60"}`}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <section className="mt-10">
        <h2 className="text-base font-bold text-ink">Items</h2>
        <ul className="mt-4 rounded-[6px] border border-hairline bg-paper px-5">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline py-4 last:border-b-0"
            >
              <div className="min-w-0">
                {/* Name is the snapshot taken at purchase time, not today's name. */}
                <Link
                  to={`/products/${item.product_id}`}
                  className="text-sm font-semibold text-ink hover:text-volt"
                >
                  {item.product_name}
                </Link>
                <p className="tabular mt-1 text-xs text-muted">
                  {item.quantity} &times; {formatPrice(item.unit_price)}
                </p>
              </div>
              <span className="tabular text-sm font-bold text-ink">
                {formatPrice(item.line_total)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-baseline justify-between rounded-[6px] border border-hairline bg-paper px-5 py-4">
          <span className="font-bold text-ink">Total</span>
          <span className="tabular text-xl font-bold text-ink">
            {formatPrice(order.total_amount)}
          </span>
        </div>
      </section>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <section className="rounded-[6px] border border-hairline bg-paper p-5">
          <h2 className="eyebrow">Shipping to</h2>
          <address className="mt-3 text-sm leading-relaxed text-ink not-italic">
            {order.shipping_full_name}
            <br />
            {order.shipping_address_line1}
            {order.shipping_address_line2 && (
              <>
                <br />
                {order.shipping_address_line2}
              </>
            )}
            <br />
            {order.shipping_city} {order.shipping_postal_code}
            <br />
            {order.shipping_country}
            {order.shipping_phone && (
              <>
                <br />
                <span className="tabular text-muted">{order.shipping_phone}</span>
              </>
            )}
          </address>
        </section>

        <section className="rounded-[6px] border border-hairline bg-paper p-5">
          <h2 className="eyebrow">Delivery notes</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {order.notes || "None given."}
          </p>
        </section>
      </div>

      {canCancel && (
        <div className="mt-10 rounded-[6px] border border-hairline bg-paper p-5">
          <h2 className="text-sm font-bold text-ink">Need to cancel?</h2>
          <p className="mt-1 text-sm text-muted">
            Cancelling returns every item to stock straight away. This cannot be undone.
          </p>
          {cancelError && (
            <p role="alert" className="mt-3 text-sm font-medium text-signal">
              {cancelError}
            </p>
          )}
          <Button
            variant="danger"
            className="mt-4"
            isLoading={isCancelling}
            onClick={() => void handleCancel()}
          >
            {isCancelling ? "Cancelling" : "Cancel this order"}
          </Button>
        </div>
      )}
    </div>
  );
}
