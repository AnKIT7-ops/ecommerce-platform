import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { CartItemRow } from "../components/CartItemRow";
import { PageHeader } from "../components/PageHeader";
import { Button, EmptyState, LoadingSpinner } from "../components/ui";
import { useCart } from "../hooks/useCart";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatPrice } from "../utils/format";

export function CartPage() {
  useDocumentTitle("Your cart");
  const navigate = useNavigate();
  const { cart, isLoading, updateItem, removeItem, clear } = useCart();
  const [isClearing, setIsClearing] = useState(false);

  if (isLoading && !cart) return <LoadingSpinner label="Loading your cart" />;

  const items = cart?.items ?? [];

  // Checkout would be rejected by the server anyway; better to say so here.
  const overstockedItem = items.find((item) => item.quantity > item.product.stock_quantity);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <PageHeader eyebrow="Cart" title="Your cart" />
        <EmptyState
          title="Your cart is empty"
          description="Browse the catalogue and add something. Items stay in your cart across visits."
          action={
            <Link to="/products">
              <Button size="lg">Start shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Cart"
        title="Your cart"
        meta={
          <>
            <span className="tabular font-semibold text-ink">{cart?.total_items ?? 0}</span>{" "}
            {cart?.total_items === 1 ? "item" : "items"}
          </>
        }
        action={
          <Button
          variant="ghost"
          size="sm"
          isLoading={isClearing}
          onClick={async () => {
            setIsClearing(true);
            try {
              await clear();
            } finally {
              setIsClearing(false);
            }
          }}
          >
            Empty cart
          </Button>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <section aria-label="Cart items">
          <ul className="rounded-[6px] border border-hairline bg-paper px-5">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onUpdateQuantity={updateItem}
                onRemove={removeItem}
              />
            ))}
          </ul>
        </section>

        <aside>
          <div className="sticky top-32 rounded-[6px] border border-hairline bg-paper p-6">
            <h2 className="display-wide text-base font-bold text-ink">Order summary</h2>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular font-semibold text-ink">
                  {formatPrice(cart?.subtotal ?? "0.00")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="text-muted">Calculated at checkout</dd>
              </div>
            </dl>

            <div className="mt-5 flex items-baseline justify-between border-t border-hairline pt-4">
              <span className="font-bold text-ink">Total</span>
              <span className="tabular text-xl font-bold text-ink">
                {formatPrice(cart?.subtotal ?? "0.00")}
              </span>
            </div>

            {overstockedItem && (
              <p
                role="alert"
                className="mt-4 rounded-[6px] border border-signal/25 bg-signal-tint px-3 py-2.5 text-xs font-medium text-signal"
              >
                {overstockedItem.product.name} only has{" "}
                {overstockedItem.product.stock_quantity} left. Reduce the quantity to continue.
              </p>
            )}

            <Button
              size="lg"
              fullWidth
              className="mt-5"
              disabled={Boolean(overstockedItem)}
              onClick={() => navigate("/checkout")}
            >
              Go to checkout
            </Button>

            <Link
              to="/products"
              className="mt-4 block text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
