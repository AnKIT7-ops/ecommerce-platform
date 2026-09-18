import { Link } from "react-router-dom";

import type { Product } from "../types";
import { formatPrice, stockLabel } from "../utils/format";
import { ProductImage } from "./ProductImage";

const TONE_CLASS = {
  good: "text-good",
  low: "text-signal",
  out: "text-muted",
} as const;

/**
 * A card modelled on a shelf label: picture, name, then a hairline spec strip
 * carrying the two numbers a shopper actually compares — price and stock.
 */
export function ProductCard({ product }: { product: Product }) {
  const stock = stockLabel(product.stock_quantity);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[6px] border border-hairline bg-paper transition-colors hover:border-ink/30">
      <ProductImage
        src={product.image_url}
        alt={product.name}
        className="aspect-square w-full"
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-[15px] leading-snug font-semibold text-ink">
          {/* Stretched link keeps the whole card clickable with one tab stop. */}
          <Link to={`/products/${product.id}`} className="after:absolute after:inset-0">
            {product.name}
          </Link>
        </h3>

        {product.description && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
            {product.description}
          </p>
        )}

        <div className="mt-auto flex items-baseline justify-between border-t border-hairline pt-3">
          <span className="tabular text-base font-bold text-ink">
            {formatPrice(product.price)}
          </span>
          <span className={`eyebrow ${TONE_CLASS[stock.tone]}`}>{stock.text}</span>
        </div>
      </div>
    </article>
  );
}
