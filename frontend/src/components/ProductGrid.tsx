import type { Product } from "../types";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  /** Label each card SPEC/01, SPEC/02 … and stagger them in on load. */
  numbered?: boolean;
}

export function ProductGrid({ products, numbered = false }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, position) => (
        <div
          key={product.id}
          className={numbered ? "reveal" : undefined}
          style={numbered ? { animationDelay: `${position * 70}ms` } : undefined}
        >
          <ProductCard product={product} {...(numbered ? { index: position } : {})} />
        </div>
      ))}
    </div>
  );
}
