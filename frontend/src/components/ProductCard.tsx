import { Link } from "react-router-dom";

import type { Product } from "../types";
import { formatPrice, stockLabel } from "../utils/format";
import { ProductImage } from "./ProductImage";

const TONE_CLASS = {
  good: "text-good",
  low: "text-signal",
  out: "text-muted",
} as const;

interface ProductCardProps {
  product: Product;
  /** Zero-based position. Supplied, the card is labelled SPEC/01, SPEC/02 … */
  index?: number;
}

/**
 * A card modelled on a catalogue specimen: registration crosshairs at the
 * corners, a condensed status label, and the price set on the expanded axis in
 * tabular figures so prices line up down a column.
 */
export function ProductCard({ product, index }: ProductCardProps) {
  const stock = stockLabel(product.stock_quantity);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[6px] border border-hairline bg-paper transition-colors hover:border-ink/30">
      <span aria-hidden className="crosshair" />

      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="eyebrow label-narrow text-muted/70">
          {index === undefined
            ? `ITEM/${String(product.id).padStart(4, "0")}`
            : `SPEC/${String(index + 1).padStart(2, "0")}`}
        </span>
        <span className={`eyebrow label-narrow ${TONE_CLASS[stock.tone]}`}>{stock.text}</span>
      </div>

      <ProductImage
        src={product.image_url}
        alt={product.name}
        className="aspect-square w-full transition-transform duration-500 group-hover:scale-[1.04]"
      />

      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
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

        <span className="tabular display-wide mt-auto border-t border-hairline pt-3 text-xl font-bold text-ink">
          {formatPrice(product.price)}
        </span>
      </div>
    </article>
  );
}
