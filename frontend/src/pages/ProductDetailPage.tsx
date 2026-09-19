import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { ProductGrid } from "../components/ProductGrid";
import { ProductImage } from "../components/ProductImage";
import { QuantitySelector } from "../components/QuantitySelector";
import { Button, ErrorMessage, LoadingSpinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { ApiError, productService } from "../services";
import type { Product, ProductDetail } from "../types";
import { formatPrice, stockLabel } from "../utils/format";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [didAdd, setDidAdd] = useState(false);

  useDocumentTitle(product?.name);

  useEffect(() => {
    const controller = new AbortController();
    const productId = Number(id);

    async function load() {
      setIsLoading(true);
      setError(null);
      setQuantity(1);
      setDidAdd(false);

      if (!Number.isFinite(productId)) {
        setError("That product link is not valid.");
        setIsLoading(false);
        return;
      }

      try {
        const detail = await productService.get(productId, controller.signal);
        setProduct(detail);
        // Related products are a nicety; a failure here must not break the page.
        productService
          .related(productId, controller.signal)
          .then(setRelated)
          .catch(() => setRelated([]));
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(
          caught instanceof ApiError && caught.status === 404
            ? "We could not find that product. It may have been removed."
            : caught instanceof Error
              ? caught.message
              : "Could not load this product.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [id]);

  async function handleAddToCart() {
    if (!product) return;

    // The cart lives on the server against a user, so signing in comes first.
    // Returning to this exact page afterwards keeps the flow unbroken.
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }

    setIsAdding(true);
    setAddError(null);
    setDidAdd(false);
    try {
      await addItem(product.id, quantity);
      setDidAdd(true);
    } catch (caught) {
      setAddError(caught instanceof Error ? caught.message : "Could not add this to your cart.");
    } finally {
      setIsAdding(false);
    }
  }

  if (isLoading) return <LoadingSpinner label="Loading product" />;

  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <ErrorMessage title="Product unavailable" message={error ?? "Product not found."} />
        <Link to="/products" className="mt-6 inline-block">
          <Button variant="secondary">Back to all products</Button>
        </Link>
      </div>
    );
  }

  const stock = stockLabel(product.stock_quantity);
  const isSoldOut = product.stock_quantity <= 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="eyebrow flex flex-wrap items-center gap-2">
          <li>
            <Link to="/products" className="transition-colors hover:text-ink">
              All products
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  to={`/products?category=${product.category.slug}`}
                  className="transition-colors hover:text-ink"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="aspect-square w-full rounded-[6px] border border-hairline"
        />

        <div className="flex flex-col">
          {product.category && (
            <Link
              to={`/products?category=${product.category.slug}`}
              className="eyebrow transition-colors hover:text-ink"
            >
              {product.category.name}
            </Link>
          )}

          <h1 className="display-wide mt-3 text-[1.75rem] leading-[1.05] font-extrabold text-ink sm:text-[2.25rem]">
            {product.name}
          </h1>

          <p className="tabular display-wide mt-5 text-[2rem] leading-none font-bold text-ink">
            {formatPrice(product.price)}
          </p>

          {/* Spec strip: the numbers a shopper compares, in one scannable row. */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-hairline bg-hairline sm:grid-cols-3">
            <div className="bg-paper px-4 py-3">
              <dt className="eyebrow label-narrow">Availability</dt>
              <dd
                className={`tabular mt-1 text-sm font-semibold ${
                  stock.tone === "out"
                    ? "text-muted"
                    : stock.tone === "low"
                      ? "text-signal"
                      : "text-good"
                }`}
              >
                {stock.text}
              </dd>
            </div>
            <div className="bg-paper px-4 py-3">
              <dt className="eyebrow label-narrow">In stock</dt>
              <dd className="tabular mt-1 text-sm font-semibold text-ink">
                {product.stock_quantity}
              </dd>
            </div>
            <div className="col-span-2 bg-paper px-4 py-3 sm:col-span-1">
              <dt className="eyebrow label-narrow">Item code</dt>
              <dd className="tabular mt-1 truncate text-sm text-ink">{product.slug}</dd>
            </div>
          </dl>

          {product.description && (
            <p className="mt-6 leading-relaxed text-muted">{product.description}</p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {!isSoldOut && (
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                max={product.stock_quantity}
                disabled={isAdding}
                label={product.name}
              />
            )}
            <Button
              size="lg"
              onClick={() => void handleAddToCart()}
              disabled={isSoldOut}
              isLoading={isAdding}
            >
              {isSoldOut ? "Out of stock" : "Add to cart"}
            </Button>
          </div>

          {!isAuthenticated && !isSoldOut && (
            <p className="mt-3 text-xs text-muted">
              You will be asked to sign in first. We will bring you straight back here.
            </p>
          )}

          <div aria-live="polite" className="mt-4 empty:mt-0">
            {didAdd && (
              <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-good/25 bg-good-tint px-4 py-3">
                <p className="text-sm font-medium text-good">
                  Added {quantity} to your cart.
                </p>
                <Link to="/cart">
                  <Button variant="secondary" size="sm">
                    View cart
                  </Button>
                </Link>
              </div>
            )}
            {addError && (
              <p role="alert" className="text-sm font-medium text-signal">
                {addError}
              </p>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <PageHeader
            level="h2"
            eyebrow="More from this department"
            title="Related products"
          />
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
