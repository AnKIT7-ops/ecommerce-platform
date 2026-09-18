import type { Money, OrderStatus } from "../types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Render an API money string for display.
 *
 * The value arrives as an exact decimal string; parsing to a float here is safe
 * because it happens once, for display only. Never accumulate floats — use
 * `toMinorUnits` and sum integers instead.
 */
export function formatPrice(value: Money): string {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? currency.format(parsed) : value;
}

/** Convert "49.95" to 4995, so totals can be summed as integers. */
export function toMinorUnits(value: Money): number {
  const [whole = "0", fraction = ""] = value.split(".");
  const cents = (fraction + "00").slice(0, 2);
  const sign = whole.trim().startsWith("-") ? -1 : 1;
  return sign * (Math.abs(Number.parseInt(whole, 10)) * 100 + Number.parseInt(cents, 10));
}

/** Convert 4995 back to "49.95". */
export function fromMinorUnits(cents: number): Money {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateFormatter.format(date);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormatter.format(date);
}

/** Zero-padded order reference, e.g. "AMP-000042". */
export function formatOrderRef(id: number): string {
  return `AMP-${String(id).padStart(6, "0")}`;
}

interface StatusPresentation {
  label: string;
  className: string;
}

const STATUS_PRESENTATION: Record<OrderStatus, StatusPresentation> = {
  pending: { label: "Pending", className: "bg-volt-tint text-volt-dark" },
  confirmed: { label: "Confirmed", className: "bg-volt-tint text-volt-dark" },
  processing: { label: "Processing", className: "bg-volt-tint text-volt-dark" },
  shipped: { label: "Shipped", className: "bg-good-tint text-good" },
  delivered: { label: "Delivered", className: "bg-good-tint text-good" },
  cancelled: { label: "Cancelled", className: "bg-signal-tint text-signal" },
};

export function statusPresentation(status: OrderStatus): StatusPresentation {
  return STATUS_PRESENTATION[status] ?? { label: status, className: "bg-shell text-muted" };
}

/** Human description of availability, used on cards and the detail page. */
export function stockLabel(quantity: number): { text: string; tone: "good" | "low" | "out" } {
  if (quantity <= 0) return { text: "Out of stock", tone: "out" };
  if (quantity <= 5) return { text: `Only ${quantity} left`, tone: "low" };
  return { text: "In stock", tone: "good" };
}
