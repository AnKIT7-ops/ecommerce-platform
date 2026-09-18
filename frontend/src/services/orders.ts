import { api } from "./api";
import type { Order, OrderSummary, Page, ShippingDetails } from "../types";

export interface CheckoutInput extends Omit<ShippingDetails, "shipping_address_line2" | "shipping_phone"> {
  shipping_address_line2?: string | null;
  shipping_phone?: string | null;
  notes?: string | null;
}

export const orderService = {
  checkout: (input: CheckoutInput) => api.post<Order>("/api/orders", input),

  list: (page = 1, size = 10, signal?: AbortSignal) =>
    api.get<Page<OrderSummary>>("/api/orders", { signal, query: { page, size } }),

  get: (id: number, signal?: AbortSignal) => api.get<Order>(`/api/orders/${id}`, { signal }),

  cancel: (id: number) => api.post<Order>(`/api/orders/${id}/cancel`),
};
