import { useState } from "react";
import { Link } from "react-router-dom";

import type { CartItem } from "../types";
import { formatPrice } from "../utils/format";
import { ProductImage } from "./ProductImage";
import { QuantitySelector } from "./QuantitySelector";
import { Spinner } from "./ui";

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (itemId: number, quantity: number) => Promise<void>;
  onRemove: (itemId: number) => Promise<void>;
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this item.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <li className="flex gap-4 border-b border-hairline py-5 last:border-b-0">
      <Link to={`/products/${item.product_id}`} className="shrink-0">
        <ProductImage
          src={item.product.image_url}
          alt={item.product.name}
          className="h-20 w-20 rounded-[6px] sm:h-24 sm:w-24"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            to={`/products/${item.product_id}`}
            className="text-[15px] font-semibold text-ink hover:text-volt"
          >
            {item.product.name}
          </Link>
          <span className="tabular text-[15px] font-bold text-ink">
            {formatPrice(item.line_total)}
          </span>
        </div>

        <p className="tabular text-xs text-muted">
          {formatPrice(item.product.price)} each
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <QuantitySelector
            value={item.quantity}
            max={item.product.stock_quantity}
            disabled={isBusy}
            label={item.product.name}
            onChange={(quantity) => {
              if (quantity !== item.quantity) {
                void run(() => onUpdateQuantity(item.id, quantity));
              }
            }}
          />

          <button
            type="button"
            disabled={isBusy}
            onClick={() => void run(() => onRemove(item.id))}
            className="text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-signal hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>

          {isBusy && <Spinner size="sm" />}
        </div>

        {item.quantity > item.product.stock_quantity && (
          <p role="alert" className="text-xs font-medium text-signal">
            Only {item.product.stock_quantity} left. Reduce the quantity before checking out.
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs font-medium text-signal">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
