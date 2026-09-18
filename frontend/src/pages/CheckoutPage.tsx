import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button, EmptyState, Input, LoadingSpinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { ApiError, orderService } from "../services";
import { formatPrice } from "../utils/format";

interface FormState {
  shipping_full_name: string;
  shipping_address_line1: string;
  shipping_address_line2: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  shipping_phone: string;
  notes: string;
}

const REQUIRED_FIELDS: { key: keyof FormState; message: string }[] = [
  { key: "shipping_full_name", message: "Enter the recipient's name." },
  { key: "shipping_address_line1", message: "Enter the street address." },
  { key: "shipping_city", message: "Enter the city." },
  { key: "shipping_postal_code", message: "Enter the postal code." },
  { key: "shipping_country", message: "Enter the country." },
];

export function CheckoutPage() {
  useDocumentTitle("Checkout");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, isLoading, reload } = useCart();

  const [form, setForm] = useState<FormState>({
    shipping_full_name: user?.full_name ?? "",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_postal_code: "",
    shipping_country: "",
    shipping_phone: "",
    notes: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  function setField(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const field of REQUIRED_FIELDS) {
      if (!form[field.key].trim()) errors[field.key] = field.message;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsPlacing(true);
    try {
      const order = await orderService.checkout({
        shipping_full_name: form.shipping_full_name.trim(),
        shipping_address_line1: form.shipping_address_line1.trim(),
        shipping_address_line2: form.shipping_address_line2.trim() || null,
        shipping_city: form.shipping_city.trim(),
        shipping_postal_code: form.shipping_postal_code.trim(),
        shipping_country: form.shipping_country.trim(),
        shipping_phone: form.shipping_phone.trim() || null,
        notes: form.notes.trim() || null,
      });

      // The server empties the cart as part of the same transaction, so pull
      // the new (empty) cart before leaving the page.
      await reload();
      navigate(`/orders/${order.id}?placed=1`, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
        // 409 means stock ran out between adding to the cart and checking out.
        setFormError(
          caught.status === 409
            ? `${caught.message} Your cart has been kept so you can adjust it.`
            : caught.message,
        );
        if (caught.status === 409) await reload();
      } else {
        setFormError("Could not place your order. Try again.");
      }
    } finally {
      setIsPlacing(false);
    }
  }

  if (isLoading && !cart) return <LoadingSpinner label="Loading your cart" />;

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-ink">Checkout</h1>
        <EmptyState
          title="There is nothing to check out"
          description="Add something to your cart first, then come back here to place the order."
          action={
            <Link to="/products">
              <Button size="lg">Browse products</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="eyebrow">Checkout</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          Where should this go?
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          No payment is taken. This is a demonstration store and checkout is simulated.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {formError && (
            <p
              role="alert"
              className="rounded-[6px] border border-signal/25 bg-signal-tint px-4 py-3 text-sm font-medium text-signal"
            >
              {formError}
            </p>
          )}

          <section className="rounded-[6px] border border-hairline bg-paper p-6">
            <h2 className="text-base font-bold text-ink">Customer</h2>
            <p className="mt-1 text-sm text-muted">
              Order updates go to{" "}
              <span className="font-medium text-ink">{user?.email}</span>.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Recipient name"
                  required
                  autoComplete="name"
                  value={form.shipping_full_name}
                  onChange={(event) => setField("shipping_full_name", event.target.value)}
                  error={fieldErrors.shipping_full_name}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.shipping_phone}
                  onChange={(event) => setField("shipping_phone", event.target.value)}
                  error={fieldErrors.shipping_phone}
                  hint="Optional. Used only if the courier needs to reach you."
                />
              </div>
            </div>
          </section>

          <section className="rounded-[6px] border border-hairline bg-paper p-6">
            <h2 className="text-base font-bold text-ink">Shipping address</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Street address"
                  required
                  autoComplete="address-line1"
                  value={form.shipping_address_line1}
                  onChange={(event) => setField("shipping_address_line1", event.target.value)}
                  error={fieldErrors.shipping_address_line1}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Apartment, suite, floor"
                  autoComplete="address-line2"
                  value={form.shipping_address_line2}
                  onChange={(event) => setField("shipping_address_line2", event.target.value)}
                  error={fieldErrors.shipping_address_line2}
                  hint="Optional."
                />
              </div>
              <Input
                label="City"
                required
                autoComplete="address-level2"
                value={form.shipping_city}
                onChange={(event) => setField("shipping_city", event.target.value)}
                error={fieldErrors.shipping_city}
              />
              <Input
                label="Postal code"
                required
                autoComplete="postal-code"
                value={form.shipping_postal_code}
                onChange={(event) => setField("shipping_postal_code", event.target.value)}
                error={fieldErrors.shipping_postal_code}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Country"
                  required
                  autoComplete="country-name"
                  value={form.shipping_country}
                  onChange={(event) => setField("shipping_country", event.target.value)}
                  error={fieldErrors.shipping_country}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[6px] border border-hairline bg-paper p-6">
            <h2 className="text-base font-bold text-ink">Delivery notes</h2>
            <label htmlFor="notes" className="mt-4 block text-sm font-medium text-ink">
              Anything the courier should know
            </label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
              maxLength={2000}
              placeholder="Optional. Gate codes, safe places, delivery windows."
              className="mt-1.5 w-full rounded-[6px] border border-hairline bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 hover:border-muted/50 focus:outline-none focus-visible:outline-2 focus-visible:outline-volt"
            />
          </section>
        </div>

        <aside>
          <div className="sticky top-32 rounded-[6px] border border-hairline bg-paper p-6">
            <h2 className="text-base font-bold text-ink">Order summary</h2>

            <ul className="mt-5 space-y-3">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ink">
                    <span className="tabular text-muted">{item.quantity}&times;</span>{" "}
                    {item.product.name}
                  </span>
                  <span className="tabular shrink-0 font-semibold text-ink">
                    {formatPrice(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2 border-t border-hairline pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular text-ink">{formatPrice(cart?.subtotal ?? "0.00")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="text-good">Free</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-hairline pt-4">
              <span className="font-bold text-ink">Total</span>
              <span className="tabular text-xl font-bold text-ink">
                {formatPrice(cart?.subtotal ?? "0.00")}
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              fullWidth
              className="mt-6"
              isLoading={isPlacing}
            >
              {isPlacing ? "Placing order" : "Place order"}
            </Button>

            <p className="mt-3 text-center text-xs text-muted">
              No card is charged. Stock is reserved the moment the order is placed.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
